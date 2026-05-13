import { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

import {
  X,
  Trophy,
  Map,
  Activity,
  RefreshCw,
} from 'lucide-react';

export default function LeaderboardPanel({
  isOpen,
  onClose,
}) {
  const { token, user } = useContext(AuthContext);

  const [board, setBoard] = useState([]);
  const [myRank, setMyRank] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ======================================================
  // FETCH LEADERBOARD
  // ======================================================

  const fetchLeaderboard = async (signal, isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setError(null);

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/leaderboard`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal,
        }
      );

      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }

      const data = await res.json();

      if (data.success) {
        setBoard(data.leaderboard || []);
        setMyRank(data.myRank || null);
      } else {
        throw new Error(data.message || 'Failed to load leaderboard');
      }
    } catch (err) {
      // Ignore fetch cancellation errors
      if (err.name === 'AbortError') return;

      console.error('Leaderboard fetch failed:', err);
      if (!isSilent) setError(err.message || 'Something went wrong.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  // ======================================================
  // FETCH WHEN PANEL OPENS & START POLLING
  // ======================================================

  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();

    // Initial fetch (shows loading state)
    fetchLeaderboard(controller.signal, false);

    // Auto-refresh every 30 seconds (silent fetch, no loading spinner)
    const intervalId = setInterval(() => {
      fetchLeaderboard(controller.signal, true);
    }, 30000);

    return () => {
      controller.abort();
      clearInterval(intervalId); // Cleanup interval when closed
    };
  }, [isOpen, token]);

  // ======================================================
  // RETRY HANDLER
  // ======================================================

  const handleRetry = () => {
    const controller = new AbortController();
    fetchLeaderboard(controller.signal, false);
  };

  return (
    <>
      {/* ======================================================
          BACKDROP OVERLAY
      ====================================================== */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] transition-opacity"
          onClick={onClose}
        />
      )}

      {/* ======================================================
          SLIDE-IN DRAWER
      ====================================================== */}
      <div
        onPointerDown={(e) => e.stopPropagation()} 
        className={`
          fixed top-0 right-0
          h-[100dvh] w-[85vw] max-w-sm
          bg-gray-900
          border-l border-gray-800
          z-[2001]
          shadow-2xl
          flex flex-col
          transform transition-transform
          duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* ======================================================
            HEADER
        ====================================================== */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-gray-900 z-10">
          <div className="flex items-center gap-3">
            <Trophy className="text-yellow-500" size={24} />
            <h2 className="text-xl font-bold text-white tracking-wide">Rankings</h2>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 transition-colors"
            aria-label="Close leaderboard"
          >
            <X size={24} />
          </button>
        </div>

        {/* ======================================================
            CONTENT
        ====================================================== */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
          
          {/* LOADING STATE */}
          {loading && (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-800/60 border border-gray-700/40 rounded-2xl p-4 h-24" />
              ))}
            </div>
          )}

          {/* ERROR STATE */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center text-center py-12 px-4">
              <p className="text-red-400 font-semibold mb-2">Failed to load leaderboard</p>
              <p className="text-sm text-gray-400 mb-6">{error}</p>
              <button
                onClick={handleRetry}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl font-semibold transition-all"
              >
                <RefreshCw size={18} /> Retry
              </button>
            </div>
          )}

          {/* EMPTY STATE */}
          {!loading && !error && board.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-16">
              <Trophy className="text-gray-600 mb-4" size={40} />
              <p className="text-gray-300 font-semibold">No rankings yet</p>
              <p className="text-sm text-gray-500 mt-2">Start running to claim territory.</p>
            </div>
          )}

          {/* LEADERBOARD LIST */}
          {!loading && !error && board.map((entry) => {
            const player = entry.user || {};
            const isMe = player?._id === user?._id;

            return (
              <div
                key={player?._id || Math.random()}
                className={`flex items-center justify-between p-4 rounded-2xl border ${isMe ? 'bg-blue-900/20 border-blue-500/50' : 'bg-gray-800/50 border-gray-700/50'}`}
              >
                {/* LEFT SIDE */}
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center justify-center w-8">
                    <span className="text-sm font-bold text-gray-400">#{entry.rank ?? '--'}</span>
                  </div>

                  {/* PLAYER INFO */}
                  <div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shadow-sm"
                        style={{ backgroundColor: player?.color || '#6b7280' }}
                      />
                      <p className={`font-bold ${isMe ? 'text-white' : 'text-gray-200'}`}>
                        {player?.name || 'Unknown Player'} {isMe && ' (You)'}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Map size={12} /> {Math.round(entry.areaConquered || 0)}m²
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity size={12} /> {Math.round(entry.totalDistance || 0)}m
                      </span>
                    </div>
                  </div>
                </div>

                {/* SCORE */}
                <div className="text-right">
                  <p className="text-lg font-black text-yellow-500">{entry.score || 0}</p>
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Score</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ======================================================
            STICKY FOOTER
        ====================================================== */}
        {!loading && !error && myRank && (
          <div className="absolute bottom-0 left-0 w-full bg-gray-800 border-t border-gray-700 p-4 shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-1">Your Standing</p>
            <div>
              <p className="text-2xl font-black text-white">
                Rank #{myRank}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}