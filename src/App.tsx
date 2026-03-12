import React, { useState, useEffect, useRef } from "react";
import { Search, Music, Download, Loader2, ExternalLink, Play, Pause, Disc, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Track {
  id?: string;
  title: string;
  artist: string;
  duration?: string;
  imageUrl?: string;
}

export default function App() {
  const [url, setUrl] = useState("https://ok.ru/music/playlist/15072583285");
  const [loading, setLoading] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // New state for search and playback
  const [localSearch, setLocalSearch] = useState("");
  const [playingTrack, setPlayingTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError(null);
    setTracks([]);

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setTracks(data.tracks || []);
        if (data.tracks?.length === 0) {
          setError("No tracks found. The playlist might be private or empty.");
        }
      }
    } catch (err) {
      setError("Failed to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-load the provided URL on first render
  useEffect(() => {
    handleSearch();
  }, []);

  const getDownloadUrl = (track: Track) => {
    // Since direct OK.ru download is restricted, we provide a search link as a fallback
    const query = encodeURIComponent(`${track.artist} - ${track.title} download mp3`);
    return `https://www.google.com/search?q=${query}`;
  };

  const togglePlay = async (track: Track) => {
    if (playingTrack?.title === track.title && playingTrack?.artist === track.artist) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play();
        setIsPlaying(true);
      }
      return;
    }

    setPlayingTrack(track);
    setIsPlaying(false);
    setPreviewLoading(true);

    try {
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(track.artist + ' ' + track.title)}&entity=song&limit=1`);
      const data = await res.json();
      if (data.results?.[0]?.previewUrl) {
        if (audioRef.current) {
          audioRef.current.src = data.results[0].previewUrl;
          audioRef.current.play();
          setIsPlaying(true);
        }
      } else {
        alert("Preview not available for this track.");
        setPlayingTrack(null);
      }
    } catch (e) {
      console.error("Failed to load preview", e);
      alert("Failed to load preview.");
      setPlayingTrack(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const filteredTracks = tracks.filter(t => 
    t.title.toLowerCase().includes(localSearch.toLowerCase()) || 
    t.artist.toLowerCase().includes(localSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a] font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Header */}
      <header className="bg-white border-b border-black/5 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <Music size={24} />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">OK Music</h1>
              <p className="text-xs text-black/40 font-medium uppercase tracking-wider">Downloader</p>
            </div>
          </div>
          
          <form onSubmit={handleSearch} className="flex-1 max-w-md ml-8 relative group">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste OK.ru playlist URL or search query..."
              className="w-full bg-[#f0f0f0] border-transparent focus:bg-white focus:border-emerald-500/30 focus:ring-4 focus:ring-emerald-500/5 rounded-2xl py-3 pl-12 pr-4 transition-all outline-none text-sm"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30 group-focus-within:text-emerald-500 transition-colors" size={18} />
          </form>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="mb-12 text-center">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-light mb-4"
          >
            Your Music, <span className="font-semibold text-emerald-600">Anywhere.</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-black/50 max-w-lg mx-auto"
          >
            Extract tracks from any public OK.ru playlist and find download links instantly.
          </motion.p>
        </div>

        {/* Status Messages */}
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center py-20 gap-4"
            >
              <Loader2 className="animate-spin text-emerald-500" size={48} />
              <p className="text-sm font-medium text-black/40 animate-pulse">Scraping playlist data...</p>
            </motion.div>
          )}

          {error && !loading && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-100 text-red-600 p-6 rounded-3xl text-center mb-8"
            >
              <p className="font-medium">{error}</p>
              <button 
                onClick={() => handleSearch()}
                className="mt-4 text-sm underline font-semibold hover:text-red-700"
              >
                Try again
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Track List */}
        {!loading && tracks.length > 0 && (
          <div className="grid gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 mb-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-black/30">
                {filteredTracks.length} Tracks Found
              </h3>
              
              <div className="relative max-w-xs w-full">
                <input
                  type="text"
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  placeholder="Filter songs..."
                  className="w-full bg-white border border-black/10 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 rounded-xl py-2 pl-10 pr-4 transition-all outline-none text-sm"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" size={16} />
              </div>
            </div>
            
            {filteredTracks.map((track, index) => {
              const isThisPlaying = playingTrack?.title === track.title && playingTrack?.artist === track.artist;
              
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(index * 0.05, 0.5) }}
                  className={`group bg-white hover:bg-emerald-50/50 border ${isThisPlaying ? 'border-emerald-500/50 shadow-emerald-500/10' : 'border-black/5 hover:border-emerald-500/20'} rounded-2xl p-4 flex items-center gap-4 transition-all hover:shadow-xl`}
                >
                  <div 
                    className="relative w-16 h-16 flex-shrink-0 cursor-pointer"
                    onClick={() => togglePlay(track)}
                  >
                    {track.imageUrl ? (
                      <img 
                        src={track.imageUrl} 
                        alt={track.title} 
                        className={`w-full h-full object-cover rounded-xl shadow-inner transition-all ${isThisPlaying && isPlaying ? 'animate-spin-slow' : ''}`}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#f0f0f0] rounded-xl flex items-center justify-center text-black/20">
                        <Disc size={32} className={isThisPlaying && isPlaying ? 'animate-spin-slow' : ''} />
                      </div>
                    )}
                    <div className={`absolute inset-0 rounded-xl flex items-center justify-center transition-all ${isThisPlaying ? 'bg-black/40 opacity-100' : 'bg-black/0 opacity-0 group-hover:bg-black/20 group-hover:opacity-100'}`}>
                      {isThisPlaying && previewLoading ? (
                        <Loader2 className="text-white animate-spin" size={24} />
                      ) : isThisPlaying && isPlaying ? (
                        <Pause className="text-white fill-white" size={24} />
                      ) : (
                        <Play className="text-white fill-white" size={24} />
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className={`font-semibold text-lg truncate transition-colors ${isThisPlaying ? 'text-emerald-600' : 'group-hover:text-emerald-700'}`}>
                      {track.title}
                    </h4>
                    <p className="text-black/40 text-sm font-medium truncate">
                      {track.artist}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={getDownloadUrl(track)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-[#f0f0f0] hover:bg-emerald-500 hover:text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
                    >
                      <Download size={18} />
                      <span className="hidden sm:inline">Download</span>
                    </a>
                  </div>
                </motion.div>
              );
            })}
            
            {filteredTracks.length === 0 && (
              <div className="text-center py-12 text-black/40">
                No songs match your filter.
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && tracks.length === 0 && !error && (
          <div className="text-center py-20 border-2 border-dashed border-black/5 rounded-[40px]">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
              <Music className="text-black/10" size={40} />
            </div>
            <h3 className="text-xl font-medium mb-2">No tracks loaded yet</h3>
            <p className="text-black/40 text-sm max-w-xs mx-auto">
              Enter a public OK.ru playlist URL above to start extracting music.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-6 py-12 border-t border-black/5 mt-12 text-center pb-32">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-black/20">
          Made with precision &bull; 2026
        </p>
      </footer>

      {/* Sticky Player */}
      <AnimatePresence>
        {playingTrack && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-2xl bg-black text-white rounded-3xl p-4 shadow-2xl flex items-center gap-4 z-50"
          >
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              {playingTrack.imageUrl ? (
                <img src={playingTrack.imageUrl} alt="Cover" className={`w-full h-full object-cover rounded-full ${isPlaying ? 'animate-spin-slow' : ''}`} referrerPolicy="no-referrer" />
              ) : (
                <Music size={20} className="text-white/50" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm truncate">{playingTrack.title}</h4>
              <p className="text-white/50 text-xs truncate">{playingTrack.artist}</p>
            </div>

            <div className="flex items-center gap-4 pr-2">
              <button 
                onClick={() => togglePlay(playingTrack)}
                className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform"
              >
                {previewLoading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : isPlaying ? (
                  <Pause size={20} className="fill-black" />
                ) : (
                  <Play size={20} className="fill-black ml-1" />
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden Audio Element */}
      <audio 
        ref={audioRef} 
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />

      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
}
