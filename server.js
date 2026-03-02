import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import compression from 'compression';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

// Compress all HTTP responses before they are sent to the client
app.use(compression());

// Serve static files from the React app (Vite 'dist' folder)
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, 'dist')));

// --- JioTV Backend Logic ---
const DATA_FOLDER = path.join(__dirname, 'assets', 'data');

function decrypt(eData, keyStr) {
    const key = parseInt(keyStr);
    const encrypted = Buffer.from(eData, 'base64');
    const decrypted = [];
    for (let i = 0; i < encrypted.length; i++) {
        // Equivalent to PHP's chr(ord($char) - $key)
        decrypted.push(String.fromCharCode((encrypted[i] - key) & 0xFF));
    }
    return decrypted.join('');
}

function getJioCredentials() {
    try {
        const credsFile = path.join(DATA_FOLDER, 'creds.jtv');
        const keyFile = path.join(DATA_FOLDER, 'credskey.jtv');

        if (!fs.existsSync(credsFile) || !fs.existsSync(keyFile)) return null;

        const eData = fs.readFileSync(credsFile, 'utf8');
        const keyB64 = fs.readFileSync(keyFile, 'utf8').trim();
        const key = Buffer.from(keyB64, 'base64').toString('utf8');

        const decrypted = decrypt(eData, key);
        return JSON.parse(decrypted);
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
        "Content-Type": "application/x-www-form-urlencoded"
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
        const playlistUrl = "https://mitthu786.github.io/tvepg/jiotv/jiodata.json";
        const response = await axios.get(playlistUrl);
        const channels = response.data;

        let m3u = '#EXTM3U x-tvg-url="https://avkb.short.gy/jioepg.xml.gz"\n';

        channels.forEach(ch => {
            const streamUrl = `http://localhost:${PORT}/api/live/${ch.channel_id}`;
            m3u += `#EXTINF:-1 tvg-id="${ch.channel_id}" tvg-name="${ch.channel_name}" group-title="${ch.channelCategoryId}" tvg-logo="${ch.logoUrl}",${ch.channel_name}\n`;
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
        // We proxy the manifest so we can rewrite relative URLs
        res.redirect(`/proxy?url=${encodeURIComponent(streamUrl)}`);
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

        // Forward headers: JioTV requires a specific UA and often tokens in headers
        const userAgent = streamUrl.includes('jio')
            ? 'plaYtv/7.1.3 (Linux;Android 14) ExoPlayerLib/2.11.7'
            : (req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

        const headers = {
            'User-Agent': userAgent,
            'Referer': `${urlObj.protocol}//${urlObj.host}/`,
            'Origin': `${urlObj.protocol}//${urlObj.host}`,
            'Accept': '*/*',
        };

        if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];

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

        // Copy over relevant headers
        if (response.headers['content-type']) {
            res.setHeader('Content-Type', response.headers['content-type']);
        }

        // Handling M3U8 Playlist (only for GET)
        if (req.method === 'GET' && (streamUrl.includes('.m3u8') || streamUrl.includes('.m3u'))) {
            let playlistData = '';
            response.data.on('data', (chunk) => { playlistData += chunk.toString(); });
            response.data.on('end', () => {
                if (playlistData.trim().startsWith('<!DOCTYPE') || playlistData.trim().startsWith('<html')) {
                    return res.status(404).send('Stream source returned an error page.');
                }

                const lines = playlistData.split('\n');
                const rewrittenLines = lines.map(line => {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('#')) {
                        const resolvedUrl = new URL(trimmed, streamUrl).href;
                        return `http://localhost:${PORT}/proxy?url=${encodeURIComponent(resolvedUrl)}`;
                    }
                    return line.replace(/URI="([^"]+)"/g, (match, subUrl) => {
                        const resolvedUrl = new URL(subUrl, streamUrl).href;
                        return `URI="http://localhost:${PORT}/proxy?url=${encodeURIComponent(resolvedUrl)}"`;
                    });
                });
                res.send(rewrittenLines.join('\n'));
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
