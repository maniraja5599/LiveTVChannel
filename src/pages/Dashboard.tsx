import { Play, Search, Heart, ChevronUp, ChevronDown, LayoutGrid, List } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppGlobal } from '../components/AppLayout';

export function Dashboard() {
    const {
        search, setSearch,
        channels, loading,
        favorites, setFavorites,
        activeFilter, setActiveFilter,
        filteredChannels: filtered,
        setChannelOrder
    } = useAppGlobal();

    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
        const saved = localStorage.getItem('jiotv-view-mode');
        return (saved as 'grid' | 'list') || 'grid';
    });

    useEffect(() => {
        localStorage.setItem('jiotv-view-mode', viewMode);
    }, [viewMode]);

    const toggleFavorite = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setFavorites(prev =>
            prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
        );
    };

    const moveChannel = (index: number, direction: 1 | -1) => {
        const currentOrder = filtered.map(c => c.id);
        const newIndex = index + direction;

        if (newIndex < 0 || newIndex >= currentOrder.length) return;

        const newOrder = [...currentOrder];
        const temp = newOrder[index];
        newOrder[index] = newOrder[newIndex];
        newOrder[newIndex] = temp;

        setChannelOrder(newOrder);
    };

    const categories = Array.from(new Set(channels.map(c => c.category))).filter(Boolean).slice(0, 5);

    return (
        <div className="w-full">
            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
                <div className="mb-8 block sm:hidden">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search channels..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-slate-700 rounded-full leading-5 bg-slate-800/50 text-slate-300 placeholder-slate-400 focus:outline-none focus:bg-slate-800 focus:ring-1 focus:ring-rose-500 focus:border-rose-500 sm:text-sm transition-colors"
                        />
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                    <div className="flex items-center justify-start overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent flex-shrink-0 mr-4">
                            Live Channels {channels.length > 0 && `(${channels.length})`}
                        </h1>
                        <div className="flex gap-2 whitespace-nowrap">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors border ${activeFilter === 'All' ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-transparent text-slate-400 border-transparent hover:text-white hover:border-slate-700'}`} onClick={() => setActiveFilter('All')}>All</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors border flex items-center gap-1 ${activeFilter === 'Favorites' ? 'bg-rose-900/50 text-rose-300 border-rose-700' : 'bg-transparent text-slate-400 border-transparent hover:text-white hover:border-slate-700'}`} onClick={() => setActiveFilter('Favorites')}><Heart size={12} className={activeFilter === 'Favorites' ? 'fill-current' : ''} /> Favorites</span>

                            <div className="w-px h-4 bg-slate-700 mx-1 self-center" />

                            <span className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors border ${activeFilter === 'Tamil' ? 'bg-indigo-900/50 text-indigo-300 border-indigo-700' : 'bg-transparent text-slate-400 border-transparent hover:text-white hover:border-slate-700'}`} onClick={() => setActiveFilter('Tamil')}>Tamil</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors border ${activeFilter === 'English' ? 'bg-indigo-900/50 text-indigo-300 border-indigo-700' : 'bg-transparent text-slate-400 border-transparent hover:text-white hover:border-slate-700'}`} onClick={() => setActiveFilter('English')}>English</span>

                            <div className="w-px h-4 bg-slate-700 mx-1 self-center" />

                            {categories.map(cat => (
                                <span
                                    key={cat}
                                    onClick={() => setActiveFilter(cat)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors border ${activeFilter === cat ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-transparent text-slate-400 border-transparent hover:text-white hover:border-slate-700'}`}
                                >
                                    {cat}
                                </span>
                            ))}
                        </div>
                    </div>
                    {/* View Toggle */}
                    <div className="flex items-center gap-2 bg-slate-800/50 p-1 rounded-lg border border-slate-700/50 flex-shrink-0 self-start sm:self-auto ml-auto">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition-all duration-200 ${viewMode === 'grid' ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/50 scale-105' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                            title="Grid View"
                        >
                            <LayoutGrid size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-all duration-200 flex items-center gap-1.5 ${viewMode === 'list' ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/50 scale-105 px-2.5' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                            title="List View (Arrange Channels)"
                        >
                            <List size={16} />
                            {viewMode === 'list' && <span className="text-xs font-medium pr-1">Arrange</span>}
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-rose-500"></div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">
                        No channels found. Please check your playlist URL or search query.
                    </div>
                ) : viewMode === 'list' ? (
                    <div className="flex flex-col gap-2.5 max-w-4xl mx-auto mb-8">
                        {/* List View Instructions */}
                        {!search && (
                            <div className="flex items-center justify-between bg-slate-800/30 border border-slate-700/30 rounded-lg p-3 sm:px-4 sm:py-3 mb-2 text-xs sm:text-sm text-slate-400">
                                <span>Use the arrows to arrange your channels. The order is automatically saved.</span>
                                <span>Filter: <strong className="text-slate-300">{activeFilter}</strong></span>
                            </div>
                        )}

                        {filtered.map((channel, index) => (
                            <div
                                key={channel.id}
                                className="group flex items-center bg-slate-900/80 rounded-xl p-2.5 sm:p-3 border border-slate-800 shadow-sm transition-all hover:bg-slate-800/80 hover:border-slate-600"
                            >
                                {/* Arrangement Controls */}
                                {!search && (
                                    <div className="flex flex-col gap-1 mr-3 sm:mr-4 ml-1">
                                        <button
                                            disabled={index === 0}
                                            onClick={(e) => { e.stopPropagation(); moveChannel(index, -1); }}
                                            className="p-1 rounded bg-slate-800/80 text-slate-400 hover:text-white hover:bg-rose-600 disabled:opacity-20 disabled:hover:bg-slate-800/80 disabled:hover:text-slate-400 transition-colors"
                                        >
                                            <ChevronUp size={16} />
                                        </button>
                                        <button
                                            disabled={index === filtered.length - 1}
                                            onClick={(e) => { e.stopPropagation(); moveChannel(index, 1); }}
                                            className="p-1 rounded bg-slate-800/80 text-slate-400 hover:text-white hover:bg-rose-600 disabled:opacity-20 disabled:hover:bg-slate-800/80 disabled:hover:text-slate-400 transition-colors"
                                        >
                                            <ChevronDown size={16} />
                                        </button>
                                    </div>
                                )}

                                {/* Numbering / Rank */}
                                {!search && (
                                    <div className="w-8 text-center text-slate-500 font-mono text-sm mr-2 hidden sm:block">
                                        {(index + 1).toString().padStart(2, '0')}
                                    </div>
                                )}

                                {/* Logo */}
                                <div className="relative cursor-pointer flex-shrink-0" onClick={() => navigate(`/watch?url=${encodeURIComponent(channel.url)}&name=${encodeURIComponent(channel.name)}`)}>
                                    <img
                                        src={channel.logo || 'https://via.placeholder.com/150'}
                                        alt={channel.name}
                                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=TV'; }}
                                        className="w-16 h-12 sm:w-20 sm:h-14 object-contain bg-slate-950 rounded-lg p-1 border border-slate-800 group-hover:border-rose-500/30 transition-colors"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity">
                                        <Play className="text-white fill-current w-5 h-5" />
                                    </div>
                                </div>

                                {/* Details */}
                                <div
                                    className="flex-1 min-w-0 ml-4 cursor-pointer"
                                    onClick={() => navigate(`/watch?url=${encodeURIComponent(channel.url)}&name=${encodeURIComponent(channel.name)}`)}
                                >
                                    <h3 className="font-semibold text-sm sm:text-base text-slate-200 group-hover:text-white truncate pr-4 transition-colors">{channel.name}</h3>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <span className="text-[10px] sm:text-xs text-slate-500 truncate">{channel.category || 'Live TV'}</span>
                                        {channel.language && (
                                            <span className="hidden sm:inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-900/30 text-indigo-400 border border-indigo-800/30">
                                                {channel.language}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 ml-2">
                                    <button
                                        onClick={(e) => toggleFavorite(e, channel.id)}
                                        className="p-2.5 sm:p-3 rounded-full hover:bg-slate-800 transition-colors flex-shrink-0"
                                    >
                                        <Heart size={18} className={`transition-colors ${favorites.includes(channel.id) ? 'fill-rose-500 text-rose-500' : 'text-slate-500 hover:text-rose-400'}`} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                        {filtered.map((channel) => (
                            <div
                                key={channel.id}
                                onClick={() => navigate(`/watch?url=${encodeURIComponent(channel.url)}&name=${encodeURIComponent(channel.name)}`)}
                                className="group relative bg-slate-900 rounded-xl overflow-hidden border border-slate-800 hover:border-rose-500/50 hover:shadow-lg hover:shadow-rose-500/10 cursor-pointer transition-all duration-300 transform hover:-translate-y-1 flex flex-col h-full"
                            >
                                <div className="aspect-video p-4 sm:p-6 bg-slate-800/80 flex items-center justify-center relative">
                                    <div className="absolute top-2 right-2 z-10">
                                        <button
                                            onClick={(e) => toggleFavorite(e, channel.id)}
                                            className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md transition-colors group/btn"
                                        >
                                            <Heart size={16} className={`transition-colors ${favorites.includes(channel.id) ? 'fill-rose-500 text-rose-500' : 'text-white group-hover/btn:text-rose-400'}`} />
                                        </button>
                                    </div>
                                    <img
                                        src={channel.logo || 'https://via.placeholder.com/150'}
                                        alt={channel.name}
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        className="w-full h-full object-contain filter drop-shadow-lg"
                                    />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[2px]">
                                        <div className="w-12 h-12 rounded-full bg-rose-600 flex items-center justify-center pl-1 shadow-lg shadow-rose-600/50">
                                            <Play className="text-white fill-current w-5 h-5" />
                                        </div>
                                    </div>
                                </div>
                                <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between">
                                    <h3 className="font-semibold text-sm line-clamp-2" title={channel.name}>{channel.name}</h3>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                        {channel.category && (
                                            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-400 truncate max-w-full">
                                                {channel.category}
                                            </span>
                                        )}
                                        {channel.language && (
                                            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-indigo-900/50 text-indigo-400 border border-indigo-800/50 truncate max-w-full">
                                                {channel.language}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
