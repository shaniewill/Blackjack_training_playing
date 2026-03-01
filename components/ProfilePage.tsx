import React, { useState, useEffect } from 'react';
import { UserProfile, fetchHistory, GameHistoryEntry } from '../utils/api';

interface ProfilePageProps {
    user: UserProfile;
    onBack: () => void;
    onLogout: () => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ user, onBack, onLogout }) => {
    const [history, setHistory] = useState<GameHistoryEntry[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    useEffect(() => {
        fetchHistory(20).then(h => { setHistory(h); setLoadingHistory(false); });
    }, []);

    const { stats, training } = user;
    const winRate = stats.total_hands > 0 ? Math.round((stats.total_won / stats.total_hands) * 100) : 0;

    return (
        <div className="min-h-screen bg-slate-900 p-4 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <h1 className="text-xl font-bold text-white">Profile</h1>
                    <button onClick={onLogout} className="text-red-400 hover:text-red-300 text-sm font-bold transition-colors">
                        Logout
                    </button>
                </div>

                {/* Profile Card */}
                <div className="bg-slate-800/80 backdrop-blur-md rounded-3xl border border-slate-700 p-6 mb-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 rounded-2xl bg-slate-700/50 flex items-center justify-center text-4xl">
                            {user.avatar}
                        </div>
                        <div>
                            <div className="text-xl font-bold text-white">{user.display_name}</div>
                            <div className="text-slate-400 text-sm">@{user.username}</div>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <div className="flex-1 bg-slate-700/40 rounded-xl px-4 py-3 text-center">
                            <div className="text-slate-400 text-xs uppercase tracking-widest">Chips</div>
                            <div className="text-emerald-400 font-bold font-mono text-lg">💰 {user.chips.toLocaleString()}</div>
                        </div>
                        <div className="flex-1 bg-slate-700/40 rounded-xl px-4 py-3 text-center">
                            <div className="text-slate-400 text-xs uppercase tracking-widest">Member Since</div>
                            <div className="text-white font-bold text-sm">{new Date(user.created_at).toLocaleDateString()}</div>
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="bg-slate-800/80 backdrop-blur-md rounded-3xl border border-slate-700 p-6 mb-6">
                    <h2 className="text-lg font-bold text-white mb-4">📊 Game Stats</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatBox label="Hands Played" value={stats.total_hands} />
                        <StatBox label="Win Rate" value={`${winRate}%`} color={winRate >= 50 ? 'text-emerald-400' : 'text-red-400'} />
                        <StatBox label="Wins" value={stats.total_won} color="text-emerald-400" />
                        <StatBox label="Losses" value={stats.total_lost} color="text-red-400" />
                        <StatBox label="Pushes" value={stats.total_pushed} color="text-slate-300" />
                        <StatBox label="Blackjacks" value={stats.total_blackjacks} color="text-amber-400" />
                        <StatBox label="Chips Won" value={stats.total_chips_won.toLocaleString()} color="text-emerald-400" />
                        <StatBox label="Chips Lost" value={stats.total_chips_lost.toLocaleString()} color="text-red-400" />
                    </div>
                </div>

                {/* Training Stats */}
                {training.total_decisions > 0 && (
                    <div className="bg-slate-800/80 backdrop-blur-md rounded-3xl border border-slate-700 p-6 mb-6">
                        <h2 className="text-lg font-bold text-white mb-4">🎓 Training Stats</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <StatBox label="Decisions" value={training.total_decisions} />
                            <StatBox label="Accuracy" value={`${training.accuracy}%`} color={training.accuracy >= 80 ? 'text-emerald-400' : 'text-amber-400'} />
                            <StatBox label="Best Streak" value={training.best_streak} color="text-amber-400" />
                        </div>
                    </div>
                )}

                {/* Game History */}
                <div className="bg-slate-800/80 backdrop-blur-md rounded-3xl border border-slate-700 p-6">
                    <h2 className="text-lg font-bold text-white mb-4">📜 Recent Games</h2>
                    {loadingHistory ? (
                        <div className="text-slate-400 text-sm animate-pulse">Loading…</div>
                    ) : history.length === 0 ? (
                        <div className="text-slate-500 text-sm">No games played yet</div>
                    ) : (
                        <div className="space-y-2 max-h-[300px] overflow-auto">
                            {history.map(g => (
                                <div key={g.id} className="flex items-center justify-between bg-slate-700/30 rounded-xl px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs uppercase font-bold text-slate-400">{g.mode}</span>
                                        <span className="text-white text-sm">
                                            {g.hands_won}W / {g.hands_lost}L / {g.hands_pushed}P
                                        </span>
                                        {g.blackjacks > 0 && <span className="text-amber-400 text-xs">🃏×{g.blackjacks}</span>}
                                    </div>
                                    <div className={`font-bold font-mono text-sm ${g.chips_delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {g.chips_delta >= 0 ? '+' : ''}{g.chips_delta}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── Stat box helper ──
function StatBox({ label, value, color }: { label: string; value: string | number; color?: string }) {
    return (
        <div className="bg-slate-700/30 rounded-xl px-3 py-3 text-center">
            <div className="text-slate-400 text-[10px] uppercase tracking-widest mb-1">{label}</div>
            <div className={`font-bold font-mono text-lg ${color || 'text-white'}`}>{value}</div>
        </div>
    );
}

export default ProfilePage;
