import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Hls from 'hls.js';
import shaka from 'shaka-player/dist/shaka-player.ui.js';
import 'shaka-player/dist/controls.css';
import { ArrowLeft, ChevronUp, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppGlobal } from '../components/AppLayout';

export function WatchPage() {
    const [searchParams] = useSearchParams();
    const streamUrl = searchParams.get('url');
    const channelName = searchParams.get('name') || 'Live TV';
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [, setIsPlaying] = useState(false);

    const [qualityLevels, setQualityLevels] = useState<{ height: number, bitrate: number, index: number }[]>([]);
    const [currentQuality, setCurrentQuality] = useState<number>(-1);
    const hlsRef = useRef<Hls | null>(null);

    // Global context to get the current list of channels matching the active filter
    const { filteredChannels } = useAppGlobal();

    // Find current channel metadata to check for DRM
    const currentChannel = filteredChannels.find(c => c.url === streamUrl);

    const changeChannel = useCallback((direction: 1 | -1) => {
        if (!filteredChannels.length || !streamUrl) return;

        const currentIndex = filteredChannels.findIndex(c => c.url === streamUrl);
        if (currentIndex === -1) return;

        let nextIndex = currentIndex + direction;
        // Loop around boundary logic
        if (nextIndex >= filteredChannels.length) nextIndex = 0;
        if (nextIndex < 0) nextIndex = filteredChannels.length - 1;

        const nextChannel = filteredChannels[nextIndex];
        // Replace: true so we don't spam the standard browser back history with channel flipping
        navigate(`/watch?url=${encodeURIComponent(nextChannel.url)}&name=${encodeURIComponent(nextChannel.name)}`, { replace: true });
    }, [filteredChannels, streamUrl, navigate]);

    const handleQualityChange = useCallback((levelIndex: number) => {
        setCurrentQuality(levelIndex);
        if (hlsRef.current) {
            hlsRef.current.currentLevel = levelIndex;
            if (levelIndex !== -1) {
                toast.success(`Quality set to manual`);
            } else {
                toast.success(`Quality set to Auto`);
            }
        }
    }, []);

    // Keyboard navigation (Supports TV remotes and PC)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                changeChannel(-1); // Up means "previous" in index
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                changeChannel(1); // Down means "next" in index
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [changeChannel]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !streamUrl) return;

        let hls: Hls | null = null;
        let shakaPlayer: shaka.Player | null = null;

        const initPlayer = async () => {
            // Apply proxy only for external URLs
            let proxyUrl = streamUrl;
            if (streamUrl.startsWith('http') && !streamUrl.includes(window.location.host)) {
                proxyUrl = `/proxy?url=${encodeURIComponent(streamUrl)}`;
            } else if (!streamUrl.startsWith('http') && !streamUrl.startsWith('/')) {
                // Fallback for relative paths that don't start with /
                proxyUrl = `/${streamUrl}`;
            }

            // Check if DRM is needed
            const hasDrm = !!currentChannel?.drmInfo?.licenseUrl;

            if (hasDrm) {
                console.log("Initializing Shaka Player for DRM stream");
                shaka.polyfill.installAll();
                if (shaka.Player.isBrowserSupported()) {
                    shakaPlayer = new shaka.Player(video);

                    // Configure DRM
                    const drmConfig: any = {};
                    if (currentChannel?.drmInfo?.drmType === 'widevine') {
                        drmConfig['com.widevine.alpha'] = currentChannel.drmInfo.licenseUrl;
                    } else if (currentChannel?.drmInfo?.drmType === 'clearkey') {
                        drmConfig['org.w3.clearkey'] = currentChannel.drmInfo.licenseUrl;
                    } else {
                        // Fallback or generic
                        drmConfig['com.widevine.alpha'] = currentChannel?.drmInfo?.licenseUrl;
                    }

                    shakaPlayer.configure({
                        drm: {
                            servers: drmConfig
                        }
                    });

                    // License request proxying
                    shakaPlayer.getNetworkingEngine()?.registerRequestFilter((type, request) => {
                        if (type === shaka.net.NetworkingEngine.RequestType.LICENSE && request.uris[0].startsWith('http')) {
                            const originalUri = request.uris[0];
                            request.uris[0] = `/proxy?url=${encodeURIComponent(originalUri)}`;
                        }
                    });

                    // Listen for errors
                    shakaPlayer.addEventListener('error', (event: any) => {
                        console.error('Shaka Error', event.detail);
                        toast.error("DRM Stream failed to load.");
                    });

                    try {
                        await shakaPlayer.load(proxyUrl);
                        console.log('The video has now been loaded!');
                        video.play().catch(e => console.log("Auto-play prevented", e));
                        setIsPlaying(true);
                    } catch (e: any) {
                        console.error('Error loading Shaka', e);
                        toast.error("Could not load secure stream.");
                    }
                } else {
                    toast.error("Browser does not support DRM streams.");
                }
            } else if (Hls.isSupported() && streamUrl.includes('.m3u8')) {
                hls = new Hls({
                    capLevelToPlayerSize: false,
                    maxBufferLength: 30,
                });

                hls.loadSource(proxyUrl);
                hls.attachMedia(video);

                hlsRef.current = hls;

                hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
                    if (data.levels && data.levels.length > 0) {
                        const levels = data.levels.map((l: any, index: number) => ({
                            height: l.height || 0,
                            bitrate: l.bitrate || 0,
                            index
                        }));
                        setQualityLevels(levels);
                    }

                    video.play().catch(e => {
                        console.log("Auto-play prevented", e);
                        toast("Click play to start video", { icon: '▶️' });
                    });
                    setIsPlaying(true);
                });

                hls.on(Hls.Events.ERROR, (_, data) => {
                    if (data.fatal) {
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                console.error("fatal network error encountered, stream may be offline.");
                                toast.error(`${channelName} is currently offline. Skipping to next channel...`);
                                if (hls) hls.destroy();
                                // Auto-skip to next channel after a short delay
                                setTimeout(() => {
                                    changeChannel(1);
                                }, 2000);
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                console.error("fatal media error encountered, try to recover");
                                hls?.recoverMediaError();
                                break;
                            default:
                                console.error("cannot recover, destroying hls player");
                                hls?.destroy();
                                toast.error("Stream failed to load.");
                                break;
                        }
                    }
                });
            } else if (video.canPlayType('application/vnd.apple.mpegurl') || streamUrl.includes('.m3u8') === false) {
                // Native support (Safari) or direct MP4/TS stream
                video.src = proxyUrl;
                video.addEventListener('loadedmetadata', () => {
                    video.play().catch(e => console.log("Auto-play prevented", e));
                    setIsPlaying(true);
                });
            }
        };

        initPlayer();

        return () => {
            if (hls) {
                hls.destroy();
            }
            if (shakaPlayer) {
                shakaPlayer.destroy();
            }
            hlsRef.current = null;
            setQualityLevels([]);
            setCurrentQuality(-1);
        };
    }, [streamUrl, currentChannel, changeChannel]);

    return (
        <div className="w-full h-full bg-black flex-1 flex flex-col pt-4 relative">
            <div className="w-full max-w-7xl mx-auto px-4 mb-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 transition-colors text-slate-300 hover:text-white"
                        title="Back to Dashboard"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="font-semibold text-lg">{channelName}</h1>
                        <p className="text-xs text-rose-500 font-medium">LIVE</p>
                    </div>
                </div>

                {/* Visual Indicators for available channels & Quality */}
                <div className="flex items-center gap-4 text-xs text-slate-500">
                    {/* Cast Button */}
                    <button
                        onClick={async () => {
                            const proxyUrl = streamUrl?.startsWith('http') && !streamUrl.includes(window.location.host)
                                ? `${window.location.origin}/proxy?url=${encodeURIComponent(streamUrl)}`
                                : streamUrl;

                            if (navigator.share) {
                                try {
                                    await navigator.share({
                                        title: `Watch ${channelName}`,
                                        text: `Open this link in your Smart TV's browser or player (VLC/Web Video Caster):`,
                                        url: proxyUrl || ''
                                    });
                                } catch (e) {
                                    // User cancelled or error
                                    if ((e as Error).name !== 'AbortError') {
                                        toast.error("Failed to share link.");
                                    }
                                }
                            } else {
                                // Fallback: Copy to clipboard
                                try {
                                    await navigator.clipboard.writeText(proxyUrl || '');
                                    toast.success("M3U8 Link copied! Paste it in your TV player app.");
                                } catch (e) {
                                    toast.error("Could not copy link. Casting not supported.");
                                }
                            }
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-lg shadow-rose-600/20 font-medium scale-105"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
                            <line x1="2" y1="20" x2="2.01" y2="20" />
                        </svg>
                        <span>Cast to TV</span>
                    </button>

                    {qualityLevels.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-white font-medium hidden sm:inline">Quality:</span>
                            <select
                                className="bg-slate-800 text-white border border-slate-700 rounded px-2 py-1 outline-none focus:border-rose-500 cursor-pointer"
                                value={currentQuality.toString()}
                                onChange={(e) => handleQualityChange(Number(e.target.value))}
                            >
                                <option value="-1">Auto</option>
                                {qualityLevels.map(lvl => (
                                    <option key={lvl.index} value={lvl.index}>
                                        {lvl.height === 0 ? 'Audio Only' : `${lvl.height}p`} {lvl.bitrate ? `(${Math.round(lvl.bitrate / 1000)}k)` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    <span className="hidden sm:inline">{filteredChannels.length} channels in filter</span>
                </div>
            </div>

            <div className="flex-1 relative group w-full max-w-7xl mx-auto flex items-center justify-center bg-black overflow-hidden">
                {/* On-Screen Mobile TV Controls */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => changeChannel(-1)}
                        className="p-3 rounded-full bg-black/60 backdrop-blur hover:bg-rose-600 transition-colors border border-white/10 text-white flex items-center justify-center shadow-lg"
                        title="Previous Channel (Up)"
                    >
                        <ChevronUp size={24} />
                    </button>
                    <button
                        onClick={() => changeChannel(1)}
                        className="p-3 rounded-full bg-black/60 backdrop-blur hover:bg-rose-600 transition-colors border border-white/10 text-white flex items-center justify-center shadow-lg"
                        title="Next Channel (Down)"
                    >
                        <ChevronDown size={24} />
                    </button>
                </div>

                <video
                    ref={videoRef}
                    className="w-full h-full max-h-[calc(100vh-8rem)] object-contain bg-black"
                    playsInline
                    autoPlay
                    controls
                />
            </div>
        </div>
    );
}
