import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import { Search, Settings } from 'lucide-react';
import { fetchAndParseM3U, type Channel } from '../lib/m3uParser';

const DEFAULT_PLAYLIST = '/api/playlist';

export type AppContextType = {
    search: string;
    setSearch: (s: string) => void;
    playlistUrl: string;
    setPlaylistUrl: (s: string) => void;
    channels: Channel[];
    loading: boolean;
    favorites: string[];
    setFavorites: React.Dispatch<React.SetStateAction<string[]>>;
    activeFilter: string;
    setActiveFilter: (s: string) => void;
    filteredChannels: Channel[];
    channelOrder: string[];
    setChannelOrder: React.Dispatch<React.SetStateAction<string[]>>;
};

export function AppLayout() {
    const [search, setSearch] = useState('');
    const [playlistUrl, setPlaylistUrl] = useState(DEFAULT_PLAYLIST);
    const [showSettings, setShowSettings] = useState(false);

    // Elevated State
    const [channels, setChannels] = useState<Channel[]>([]);
    const [loading, setLoading] = useState(true);
    const [favorites, setFavorites] = useState<string[]>(() => {
        const saved = localStorage.getItem('jiotv-favorites');
        return saved ? JSON.parse(saved) : [];
    });
    const [channelOrder, setChannelOrder] = useState<string[]>(() => {
        const saved = localStorage.getItem('jiotv-channel-order');
        return saved ? JSON.parse(saved) : [];
    });
    const [activeFilter, setActiveFilter] = useState('All');

    const navigate = useNavigate();
    const location = useLocation();

    // Fetch Channels
    useEffect(() => {
        async function loadChannels() {
            setLoading(true);
            const data = await fetchAndParseM3U(playlistUrl);
            const filtered = data.filter(c => c.url.includes('.m3u8') || c.url.includes('.ts'));
            setChannels(filtered);
            setLoading(false);
        }
        loadChannels();
    }, [playlistUrl]);

    // Save favorites & channelOrder
    useEffect(() => {
        localStorage.setItem('jiotv-favorites', JSON.stringify(favorites));
    }, [favorites]);

    useEffect(() => {
        localStorage.setItem('jiotv-channel-order', JSON.stringify(channelOrder));
    }, [channelOrder]);

    // Compute Filtered Channels
    const filteredChannels = channels.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
            (c.category && c.category.toLowerCase().includes(search.toLowerCase())) ||
            (c.language && c.language.toLowerCase().includes(search.toLowerCase()));

        if (!matchesSearch) return false;

        if (activeFilter === 'All') return true;
        if (activeFilter === 'Favorites') return favorites.includes(c.id);
        if (activeFilter === 'Tamil' || activeFilter === 'English') return c.language === activeFilter;
        return c.category === activeFilter;
    });

    // Apply custom sorting globally if no search
    if (search === '') {
        filteredChannels.sort((a, b) => {
            const indexA = channelOrder.indexOf(a.id);
            const indexB = channelOrder.indexOf(b.id);

            // If both are found in the list, sort by their saved index
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            // If only A is found, A comes first
            if (indexA !== -1) return -1;
            // If only B is found, B comes first
            if (indexB !== -1) return 1;
            // If neither are found, keep their natural alphabetical/default order or move them to the end
            return 0;
        });
    }

    // If typing search from another page, let's navigate to home
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        if (location.pathname !== '/') {
            navigate('/');
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col">
            <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16 gap-4">
                        <div
                            className="flex items-center gap-2 cursor-pointer transition-transform hover:scale-105 flex-shrink-0"
                            onClick={() => navigate('/')}
                        >
                            <div className="w-8 h-8 rounded bg-rose-600 flex items-center justify-center font-bold">J</div>
                            <span className="font-bold text-xl tracking-tight hidden sm:block">JioTV Go</span>
                        </div>

                        <div className="flex-1 max-w-xl mx-4 sm:mx-8 hidden sm:block">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="h-4 w-4 text-slate-400" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search channels..."
                                    value={search}
                                    onChange={handleSearchChange}
                                    className="block w-full pl-10 pr-3 py-2 border border-slate-700 rounded-full leading-5 bg-slate-800/50 text-slate-300 placeholder-slate-400 focus:outline-none focus:bg-slate-800 focus:ring-1 focus:ring-rose-500 focus:border-rose-500 sm:text-sm transition-colors"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-4 ml-auto flex-shrink-0">
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-sm"
                            >
                                <Settings size={18} /> <span className="hidden md:inline">Server Setup</span>
                            </button>
                            <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 shadow flex items-center justify-center text-xs font-medium cursor-pointer">
                                U
                            </div>
                        </div>
                    </div>

                    {showSettings && (
                        <div className="p-4 bg-slate-800/50 border-t border-slate-700 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                            <span className="text-sm font-medium text-slate-300 whitespace-nowrap">M3U Playlist URL:</span>
                            <input
                                type="text"
                                value={playlistUrl}
                                onChange={(e) => setPlaylistUrl(e.target.value)}
                                className="flex-1 w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-rose-500"
                                placeholder="http://localhost:5300/playlist.m3u or external M3U link"
                            />
                        </div>
                    )}
                </div>
            </header>

            {/* We don't wrap with flex-1 here so the child determines layout, but we can make it w-full */}
            <main className="flex-1 flex flex-col relative w-full h-full">
                <Outlet context={{
                    search, setSearch,
                    playlistUrl, setPlaylistUrl,
                    channels, loading, favorites, setFavorites,
                    activeFilter, setActiveFilter, filteredChannels,
                    channelOrder, setChannelOrder
                }} />
            </main>
        </div>
    );
}

export function useAppGlobal() {
    return useOutletContext<AppContextType>();
}
