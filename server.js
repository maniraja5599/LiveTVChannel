import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import compression from 'compression';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({
    origin: '*',
    exposedHeaders: ['Content-Length', 'Content-Range'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Range']
}));

// Trust proxy for correct protocol detection on Railway
app.set('trust proxy', true);

// Compress all HTTP responses before they are sent to the client
app.use(compression());

// Serve static files from the React app (Vite 'dist' folder)
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, 'dist')));

// --- JioTV Backend Logic ---
const DATA_FOLDER = path.join(__dirname, 'assets', 'data');

function getJioCredentials() {
    try {
        const credsFile = path.join(DATA_FOLDER, 'creds.jtv');
        if (!fs.existsSync(credsFile)) {
            console.error("Missing credentials file:", credsFile);
            return null;
        }

        const eData = fs.readFileSync(credsFile, 'utf8');
        // Based on investigation, the file is either plain JSON or Base64 of JSON.
        // PHP's decrypt_data with a string key that starts with letters results in a key of 0.
        let rawData = eData;
        try {
            // Try base64 decode first
            rawData = Buffer.from(eData, 'base64').toString('utf8');
            console.log("Attempted Base64 decode for creds.jtv");
        } catch (e) {
            console.log("creds.jtv not Base64 encoded, trying as plain text. Error:", e.message);
        }

        // If it starts with {, it's JSON
        if (rawData.trim().startsWith('{')) {
            console.log("creds.jtv successfully parsed as JSON.");
            return JSON.parse(rawData);
        }

        console.error("creds.jtv content is not valid JSON after decoding attempt.");
        return null;
    } catch (e) {
        console.error("Error loading Jio credentials:", e);
        return null;
    }
}

async function getJioStreamUrl(id) {
    const creds = getJioCredentials();
    if (!creds) throw new Error("Jio session not found. Please log in locally first.");

    const { authToken, deviceId, sessionAttributes } = creds;
    const subscriberId = sessionAttributes?.user?.subscriberId;
    const uniqueId = sessionAttributes?.user?.unique;

    const postData = new URLSearchParams({
        stream_type: 'Seek',
        channel_id: id
    }).toString();

    const headers = {
        "appkey": "NzNiMDhlYzQyNjJm",
        "channel_id": id,
        "userid": subscriberId,
        "crmid": subscriberId,
        "deviceId": deviceId,
        "devicetype": "phone",
        "isott": "true",
        "languageId": "6",
        "lbcookie": "1",
        "os": "android",
        "dm": "Xiaomi 22101316UP",
        "osversion": "14",
        "srno": "250918144000",
        "accesstoken": authToken,
        "subscriberid": subscriberId,
        "uniqueId": uniqueId,
        "usergroup": "tvYR7NSNn7rymo3F",
        "User-Agent": "plaYtv/7.1.3 (Linux;Android 14) ExoPlayerLib/2.11.7",
        "versionCode": "452",
        "Content-Type": "application/x-www-form-urlencoded",
        "Origin": "https://www.jiocinema.com",
        "Referer": "https://www.jiocinema.com/"
    };

    const res = await axios.post("https://jiotvapi.media.jio.com/playback/apis/v1/geturl?langId=6", postData, { headers });
    if (res.data && res.data.code === 200) {
        return res.data.result;
    } else {
        throw new Error("Jio API Error: " + (res.data?.message || "Unknown error"));
    }
}

// API: Get the Playlist (M3U)
app.get('/api/playlist', async (req, res) => {
    try {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers.host;
        const baseUrl = `${protocol}://${host}`;

        const playlistUrl = "https://mitthu786.github.io/tvepg/jiotv/jiodata.json";
        const response = await axios.get(playlistUrl);
        const channels = response.data;

        let m3u = '#EXTM3U x-tvg-url="https://avkb.short.gy/jioepg.xml.gz"\n';

        channels.forEach(ch => {
            const streamUrl = `${baseUrl}/api/live/${ch.channel_id}`;
            m3u += `#EXTINF:-1 tvg-id="${ch.channel_id}" tvg-name="${ch.channel_name}" group-title="${ch.channelCategoryId}" tvg-language="${ch.channelLanguageId || ''}" tvg-logo="${ch.logoUrl}",${ch.channel_name}\n`;
            m3u += `${streamUrl}\n\n`;
        });

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(m3u);
    } catch (e) {
        res.status(500).send("Error generating playlist: " + e.message);
    }
});

// API: Get the actual HLS stream manifest for a channel
app.get('/api/live/:id', async (req, res) => {
    try {
        const streamUrl = await getJioStreamUrl(req.params.id);
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers.host;
        const baseUrl = `${protocol}://${host}`;

        // Use absolute URL for the redirect
        res.redirect(`${baseUrl}/proxy?url=${encodeURIComponent(streamUrl)}`);
    } catch (e) {
        res.status(500).send("Stream Error: " + e.message);
    }
});

// A generic proxy endpoint that fetches the URL and passes headers
app.all('/proxy', async (req, res) => {
    const streamUrl = req.query.url;

    if (!streamUrl || typeof streamUrl !== 'string') {
        return res.status(400).send('Missing url parameter');
    }

    try {
        const urlObj = new URL(streamUrl);
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers.host;
        const baseUrl = `${protocol}://${host}`;

        // Forward headers: JioTV requires a specific UA and often tokens in headers
        const isJio = streamUrl.includes('jio') || streamUrl.includes('akamaized.net') || streamUrl.includes('media.jio.com');
        const userAgent = isJio
            ? 'plaYtv/7.1.3 (Linux;Android 14) ExoPlayerLib/2.11.7'
            : (req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

        const headers = {
            'User-Agent': userAgent,
            'Referer': isJio ? 'https://www.jiocinema.com/' : `${urlObj.protocol}//${urlObj.host}/`,
            'Origin': isJio ? 'https://www.jiocinema.com' : `${urlObj.protocol}//${urlObj.host}`,
            'Accept': '*/*',
            'Accept-Encoding': 'identity',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        };

        if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
        if (req.headers['range']) headers['Range'] = req.headers['range'];

        const config = {
            method: req.method,
            url: streamUrl,
            headers,
            responseType: 'stream',
            validateStatus: () => true,
            timeout: 15000,
        };

        if (req.method === 'POST') config.data = req;

        const response = await axios(config);

        console.log(`[Proxy] Upstream: ${streamUrl.substring(0, 100)}... Status: ${response.status}`);

        // Handling M3U8 Playlist (only for GET)
        const isM3U8 = req.method === 'GET' && (streamUrl.includes('.m3u8') || streamUrl.includes('.m3u'));

        // Copy over relevant headers
        if (response.headers['content-type']) {
            res.setHeader('Content-Type', response.headers['content-type']);
        }

        // Only forward length/ranges for non-m3u8 (segments) as we rewrite m3u8
        if (!isM3U8) {
            if (response.headers['content-length']) {
                res.setHeader('Content-Length', response.headers['content-length']);
            }
            if (response.headers['accept-ranges']) {
                res.setHeader('Accept-Ranges', response.headers['accept-ranges']);
            }
        }

        if (isM3U8) {
            let playlistData = '';
            response.data.on('data', (chunk) => { playlistData += chunk.toString(); });
            response.data.on('end', () => {
                if (!playlistData || playlistData.trim().length === 0) {
                    console.error(`[Proxy] Empty response from upstream: ${streamUrl}`);
                    return res.status(502).send('Upstream returned an empty manifest. The source may be restricted or offline.');
                }

                if (playlistData.trim().startsWith('<!DOCTYPE') || playlistData.trim().startsWith('<html')) {
                    console.error(`[Proxy] Upstream returned HTML instead of M3U8: ${streamUrl}`);
                    return res.status(404).send('Stream source returned an error page.');
                }

                const lines = playlistData.split('\n');
                const rewrittenLines = lines.map(line => {
                    const trimmed = line.trim();
                    if (!trimmed) return line;

                    if (trimmed.startsWith('#')) {
                        // Handle URI attributes in tags like #EXT-X-KEY or #EXT-X-MAP
                        return line.replace(/URI="([^"]+)"/g, (match, subUrl) => {
                            try {
                                const resolvedUrl = new URL(subUrl, streamUrl);
                                // Persist query params if missing
                                if (urlObj.search && !resolvedUrl.search) {
                                    resolvedUrl.search = urlObj.search;
                                }
                                return `URI="${baseUrl}/proxy?url=${encodeURIComponent(resolvedUrl.href)}"`;
                            } catch (e) {
                                return match;
                            }
                        });
                    } else {
                        // Handle actual segment/manifest URLs
                        try {
                            const resolvedUrl = new URL(trimmed, streamUrl);
                            // Persist query params (tokens like __hdnea) from the parent URL if child lacks them
                            if (urlObj.search && !resolvedUrl.search) {
                                resolvedUrl.search = urlObj.search;
                            }
                            return `${baseUrl}/proxy?url=${encodeURIComponent(resolvedUrl.href)}`;
                        } catch (e) {
                            return line;
                        }
                    }
                });
                res.send(rewrittenLines.join('\n'));
            });
            response.data.on('error', (err) => {
                console.error(`[Proxy] Stream Error: ${err.message}`);
                if (!res.headersSent) res.status(502).send('Error reading upstream stream');
            });
            return;
        }

        res.status(response.status);
        response.data.pipe(res);

    } catch (error) {
        console.error("[Proxy] Critical Error:", error.message);
        res.status(500).send('Proxy error: ' + error.message);
    }
});

// Handle React Router, return all requests to React app
app.get(/.*/, (req, res) => {
    if (!req.path.startsWith('/proxy') && !req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    } else {
        res.status(404).send('Not found');
    }
});

app.listen(PORT, () => {
    console.log(`Streaming Proxy Server running on http://localhost:${PORT}`);
});
