import React, { useState, useEffect } from 'react';
import { fetchLeaderboard, LeaderboardEntry } from '../utils/api';

interface LeaderboardProps {
    onBack: () => void;
    myUserId?: number;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ onBack, myUserId }) => {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLeaderboard().then(e => { setEntries(e); setLoading(false); });
    }, []);

    return (
        <div className="min-h-screen bg-slate-900 p-4 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <h1 className="text-xl font-bold text-white">🏆 Leaderboard</h1>
                    <div className="w-6" />
                </div>

                <div className="bg-slate-800/80 backdrop-blur-md rounded-3xl border border-slate-700 overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-slate-400 animate-pulse">Loading…</div>
                    ) : entries.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">No players yet. Be the first!</div>
                    ) : (
                        <div className="divide-y divide-slate-700/50">
                            {entries.map((entry, i) => {
                                const rank = i + 1;
                                const isMe = entry.id === myUserId;
                                const medalColors = ['text-amber-400', 'text-slate-300', 'text-amber-700'];
                                const medals = ['🥇', '🥈', '🥉'];

                                return (
                                    <div
                                        key={entry.id}
                                        className={`flex items-center gap-3 px-4 sm:px-6 py-4 transition-colors ${isMe ? 'bg-blue-950/40' : 'hover:bg-slate-700/20'}`}
                                    >
                                        {/* Rank */}
                                        <div className={`w-8 text-center font-bold text-lg ${rank <= 3 ? medalColors[rank - 1] : 'text-slate-500'}`}>
                                            {rank <= 3 ? medals[rank - 1] : rank}
                                        </div>

                                        {/* Avatar + Name */}
                                        <div className="w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center text-xl">
                                            {entry.avatar}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className={`font-bold text-sm truncate ${isMe ? 'text-blue-300' : 'text-white'}`}>
                                                {entry.display_name}
                                                {isMe && <span className="text-blue-400 text-xs ml-2">YOU</span>}
                                            </div>
                                            <div className="text-slate-400 text-xs">
                                                {entry.total_hands} hands • {entry.win_rate}% win rate
                                            </div>
                                        </div>

                                        {/* Chips */}
                                        <div className="text-emerald-400 font-bold font-mono text-sm sm:text-base">
                                            💰 {entry.chips.toLocaleString()}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Leaderboard;
