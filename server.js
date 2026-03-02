import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

// A generic proxy endpoint that fetches the URL and passes headers
app.all('/proxy', async (req, res) => {
    const streamUrl = req.query.url;

    if (!streamUrl || typeof streamUrl !== 'string') {
        return res.status(400).send('Missing url parameter');
    }

    try {
        const urlObj = new URL(streamUrl);

        // Forward the client's own User-Agent if possible, otherwise use a realistic browser one
        const userAgent = req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';

        const headers = {
            'User-Agent': userAgent,
            'Referer': `${urlObj.protocol}//${urlObj.host}/`,
            'Origin': `${urlObj.protocol}//${urlObj.host}`,
            'Accept': '*/*',
        };

        // Forward content-type if it's a POST request (license servers)
        if (req.headers['content-type']) {
            headers['Content-Type'] = req.headers['content-type'];
        }

        const config = {
            method: req.method,
            url: streamUrl,
            headers,
            responseType: 'stream',
            validateStatus: () => true,
            timeout: 15000,
        };

        if (req.method === 'POST') {
            config.data = req;
        }

        const response = await axios(config);

        console.log(`[Proxy] ${req.method} ${response.status} <- ${streamUrl}`);

        // Copy over relevant headers
        if (response.headers['content-type']) {
            res.setHeader('Content-Type', response.headers['content-type']);
        }

        // Handling M3U8 Playlist (only for GET)
        if (req.method === 'GET' && (streamUrl.includes('.m3u8') || streamUrl.includes('.m3u'))) {
            let playlistData = '';

            response.data.on('data', (chunk) => {
                playlistData += chunk.toString();
            });

            response.data.on('end', () => {
                // If it starts with HTML, it's an error page from Astra/Server
                if (playlistData.trim().startsWith('<!DOCTYPE') || playlistData.trim().startsWith('<html')) {
                    console.error(`[Proxy] Received HTML instead of M3U8 error for ${streamUrl}`);
                    res.status(404).send('Stream source returned an error page (404/Offline).');
                    return;
                }

                const lines = playlistData.split('\n');
                const rewrittenLines = lines.map(line => {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('#')) {
                        let absoluteUrl = trimmed;
                        try {
                            const resolvedUrl = new URL(trimmed, streamUrl);
                            absoluteUrl = resolvedUrl.href;
                        } catch (e) {
                            if (!trimmed.startsWith('http')) {
                                const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf('/') + 1);
                                absoluteUrl = baseUrl + trimmed;
                            }
                        }
                        return `http://localhost:${PORT}/proxy?url=${encodeURIComponent(absoluteUrl)}`;
                    }

                    // Also rewrite URIs inside tags like #EXT-X-SESSION-KEY or #EXT-X-MEDIA
                    return line.replace(/URI="([^"]+)"/g, (match, subUrl) => {
                        try {
                            const resolvedUrl = new URL(subUrl, streamUrl);
                            return `URI="http://localhost:${PORT}/proxy?url=${encodeURIComponent(resolvedUrl.href)}"`;
                        } catch (e) {
                            return match;
                        }
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

app.listen(PORT, () => {
    console.log(`Streaming Proxy Server running on http://localhost:${PORT}`);
});
