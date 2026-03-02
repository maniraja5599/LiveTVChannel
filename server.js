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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust proxy for correct protocol detection on Railway
app.set('trust proxy', true);

// Compress all HTTP responses before they are sent to the client
app.use(compression());

// Serve static files from the React app (Vite 'dist' folder)
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, 'dist')));

// --- JioTV Backend Logic ---
const DATA_FOLDER = path.join(__dirname, 'assets', 'data');
if (!fs.existsSync(DATA_FOLDER)) fs.mkdirSync(DATA_FOLDER, { recursive: true });

function node_encrypt(data, keyStr) {
    const key = parseInt(keyStr) || 0;
    let encrypted = '';
    for (let i = 0; i < data.length; i++) {
        encrypted += String.fromCharCode(data.charCodeAt(i) + key);
    }
    return Buffer.from(encrypted).toString('base64');
}

function getJioCredentials() {
    try {
        const credsFile = path.join(DATA_FOLDER, 'creds.jtv');
        const keyFile = path.join(DATA_FOLDER, 'credskey.jtv');

        if (!fs.existsSync(credsFile)) {
            console.error("Missing credentials file:", credsFile);
            return null;
        }

        const eData = fs.readFileSync(credsFile, 'utf8');
        const keyData = fs.existsSync(keyFile) ? fs.readFileSync(keyFile, 'utf8') : "0";

        const key = parseInt(keyData) || 0;
        const encrypted = Buffer.from(eData, 'base64');
        let rawData = '';
        for (let i = 0; i < encrypted.length; i++) {
            rawData += String.fromCharCode(encrypted[i] - key);
        }

        if (rawData.trim().startsWith('{')) {
            console.log("creds.jtv successfully parsed as JSON.");
            return JSON.parse(rawData);
        }

        console.error("creds.jtv content is not valid JSON after decryption.");
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

// API: Send OTP
app.post('/api/login/send', async (req, res) => {
    try {
        const { mobile } = req.body;
        if (!mobile || mobile.length !== 10) return res.status(400).json({ error: "Invalid mobile number" });

        const payload = { number: Buffer.from('+91' + mobile).toString('base64') };
        const response = await axios.post('https://jiotvapi.media.jio.com/userservice/apis/v1/loginotp/send', payload, {
            headers: {
                'appname': 'RJIL_JioTV',
                'os': 'android',
                'devicetype': 'phone',
                'Content-Type': 'application/json',
                'User-Agent': 'okhttp/3.14.9'
            }
        });

        if (response.status === 204) {
            res.json({ status: "success", message: "OTP Sent Successfully" });
        } else {
            res.status(response.status).json({ error: response.data?.message || "Failed to send OTP" });
        }
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message });
    }
});

// API: Verify OTP
app.post('/api/login/verify', async (req, res) => {
    try {
        const { mobile, otp } = req.body;
        if (!mobile || !otp) return res.status(400).json({ error: "Mobile and OTP are required" });

        const payload = {
            number: Buffer.from('+91' + mobile).toString('base64'),
            otp: otp,
            deviceInfo: {
                consumptionDeviceName: 'RMX1945',
                info: {
                    type: 'android',
                    platform: { name: 'RMX1945' },
                    androidId: Math.random().toString(36).substring(2, 18)
                }
            }
        };

        const response = await axios.post('https://jiotvapi.media.jio.com/userservice/apis/v1/loginotp/verify', payload, {
            headers: {
                'appname': 'RJIL_JioTV',
                'os': 'android',
                'devicetype': 'phone',
                'Content-Type': 'application/json',
                'User-Agent': 'okhttp/3.14.9'
            }
        });

        if (response.data && response.data.ssoToken) {
            const u_name = node_encrypt(mobile, "TS-JIOTV");
            const encryptedCreds = node_encrypt(JSON.stringify(response.data), u_name);

            fs.writeFileSync(path.join(DATA_FOLDER, 'creds.jtv'), encryptedCreds);
            fs.writeFileSync(path.join(DATA_FOLDER, 'credskey.jtv'), u_name);

            res.json({ status: "success", message: "Logged In Successfully" });
        } else {
            res.status(401).json({ error: response.data?.message || "Invalid OTP" });
        }
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message });
    }
});

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

// API: Diagnostics for Railway connectivity
app.get('/api/diag', async (req, res) => {
    try {
        const ipRes = await axios.get('https://api.ipify.org?format=json', { timeout: 5000 });
        const jioTest = await axios.get('https://jiotvapi.media.jio.com/playback/apis/v1/geturl?langId=6', {
            validateStatus: () => true,
            timeout: 5000
        });

        res.json({
            server_ip: ipRes.data.ip,
            jio_api_status: jioTest.status,
            jio_api_connected: jioTest.status === 405 || jioTest.status === 403 || jioTest.status === 200,
            session_active: !!getJioCredentials(),
            session_files: {
                creds: fs.existsSync(path.join(DATA_FOLDER, 'creds.jtv')),
                key: fs.existsSync(path.join(DATA_FOLDER, 'credskey.jtv'))
            },
            node_version: process.version,
            platform: process.platform,
            env: process.env.NODE_ENV || 'production'
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
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

        // Handling M3U8 Playlist (only for GET)
        const isM3U8 = req.method === 'GET' && (streamUrl.includes('.m3u8') || streamUrl.includes('.m3u'));

        // Forward headers: JioTV requires a specific UA and often tokens in headers
        const isJio = streamUrl.includes('jio') || streamUrl.includes('akamaized.net') || streamUrl.includes('media.jio.com');
        const userAgent = isJio
            ? 'plaYtv/7.1.3 (Linux;Android 14) ExoPlayerLib/2.11.7'
            : (req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

        const headers = {
            'Host': urlObj.host,
            'User-Agent': 'okhttp/4.12.13',
            'Referer': isJio ? 'https://www.jiocinema.com/' : `${urlObj.protocol}//${urlObj.host}/`,
            'Origin': isJio ? 'https://www.jiocinema.com' : `${urlObj.protocol}//${urlObj.host}`,
            'Accept': '*/*',
            'Accept-Encoding': 'identity',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'X-Forwarded-For': req.ip || req.headers['x-forwarded-for'],
            'X-Real-IP': req.ip || req.headers['x-forwarded-for'],
            'X-Forwarded-Proto': req.headers['x-forwarded-proto'] || req.protocol
        };

        console.log(`[Proxy] Routing ${isM3U8 ? 'Manifest' : 'Segment'} (Client IP: ${req.ip} -> Upstream: ${urlObj.host})`);

        if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
        if (req.headers['range']) headers['Range'] = req.headers['range'];

        const config = {
            method: req.method,
            url: streamUrl,
            headers,
            responseType: isM3U8 ? 'arraybuffer' : 'stream',
            validateStatus: () => true,
            timeout: 20000,
            decompress: true
        };

        if (req.method === 'POST') config.data = req;

        const response = await axios(config);

        console.log(`[Proxy] Upstream Status: ${response.status} | URL: ${streamUrl.substring(0, 80)}...`);
        console.log(`[Proxy] Upstream Headers:`, JSON.stringify(response.headers));

        // Handle upstream errors
        if (response.status >= 400 && !isM3U8) {
            console.error(`[Proxy] Upstream returned error ${response.status} for ${streamUrl}`);
            res.status(response.status);
            return response.data.pipe(res);
        }

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
            const playlistData = Buffer.from(response.data).toString('utf8');

            if (!playlistData || playlistData.trim().length === 0) {
                console.error(`[Proxy] Empty response from upstream: ${streamUrl}. Status: ${response.status}`);
                return res.status(502).send(`Upstream returned an empty manifest (${response.status}). This often means the Railway server IP is blocked or the session is invalid.`);
            }

            if (playlistData.trim().startsWith('<!DOCTYPE') || playlistData.trim().startsWith('<html')) {
                console.error(`[Proxy] Upstream returned HTML instead of M3U8: ${streamUrl}`);
                return res.status(403).send('Stream source returned an error page (Access Denied). Your session may be expired or IP blocked.');
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
                            // Aggressively persist all query params from master to child
                            if (urlObj.search) {
                                const masterParams = new URLSearchParams(urlObj.search);
                                const childParams = new URLSearchParams(resolvedUrl.search);
                                for (const [key, value] of masterParams.entries()) {
                                    if (!childParams.has(key)) childParams.set(key, value);
                                }
                                resolvedUrl.search = childParams.toString();
                            }
                            return `URI="${baseUrl}/proxy?url=${encodeURIComponent(resolvedUrl.href)}"`;
                        } catch (e) { return match; }
                    });
                } else {
                    // Handle actual segment/manifest URLs
                    try {
                        const resolvedUrl = new URL(trimmed, streamUrl);
                        // Aggressively persist all query params (tokens like __hdnea)
                        if (urlObj.search) {
                            const masterParams = new URLSearchParams(urlObj.search);
                            const childParams = new URLSearchParams(resolvedUrl.search);
                            for (const [key, value] of masterParams.entries()) {
                                if (!childParams.has(key)) childParams.set(key, value);
                            }
                            resolvedUrl.search = childParams.toString();
                        }
                        return `${baseUrl}/proxy?url=${encodeURIComponent(resolvedUrl.href)}`;
                    } catch (e) { return line; }
                }
            });
            return res.send(rewrittenLines.join('\n'));
        }

        res.status(response.status);
        response.data.pipe(res);

    } catch (error) {
        console.error("[Proxy] Critical Error:", error.stack);
        if (!res.headersSent) {
            res.status(500).send(`Proxy Error: ${error.message}\n\nStack: ${error.stack}\n\nHint: Check if the upstream URL is valid and accessible from this server.`);
        }
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
