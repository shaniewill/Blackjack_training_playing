import React, { useState } from 'react';
import { register, login, setToken, UserProfile } from '../utils/api';

interface AuthScreenProps {
    onAuth: (user: UserProfile) => void;
    onGuest: () => void;
}

const AVATARS = ['🎰', '♠️', '♦️', '♣️', '♥️', '🃏', '👑', '💎', '🎲', '🏆', '🔥', '⭐'];

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuth, onGuest }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [avatar, setAvatar] = useState('🎰');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const result = isLogin
                ? await login(username, password)
                : await register(username, password, displayName || username, avatar);
            setToken(result.token);
            onAuth(result.user);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
            <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-md p-8 rounded-3xl shadow-2xl border border-slate-700">
                <h1 className="text-3xl font-bold text-center text-white mb-1">🃏 Blackjack</h1>
                <p className="text-slate-400 text-center mb-6 text-sm">
                    {isLogin ? 'Welcome back!' : 'Create your account'}
                </p>

                {/* Toggle */}
                <div className="flex bg-slate-700/50 rounded-xl p-1 mb-6">
                    <button
                        onClick={() => { setIsLogin(true); setError(null); }}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${isLogin ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        Login
                    </button>
                    <button
                        onClick={() => { setIsLogin(false); setError(null); }}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${!isLogin ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        Register
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-slate-400 text-xs uppercase tracking-widest block mb-1">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder="Enter username"
                            className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                            required
                            autoComplete="username"
                        />
                    </div>
                    <div>
                        <label className="text-slate-400 text-xs uppercase tracking-widest block mb-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="Enter password"
                            className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                            required
                            autoComplete={isLogin ? 'current-password' : 'new-password'}
                        />
                    </div>

                    {!isLogin && (
                        <>
                            <div>
                                <label className="text-slate-400 text-xs uppercase tracking-widest block mb-1">Display Name (optional)</label>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={e => setDisplayName(e.target.value)}
                                    placeholder="How others see you"
                                    className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="text-slate-400 text-xs uppercase tracking-widest block mb-2">Avatar</label>
                                <div className="flex gap-2 flex-wrap">
                                    {AVATARS.map(a => (
                                        <button
                                            key={a}
                                            type="button"
                                            onClick={() => setAvatar(a)}
                                            className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${avatar === a
                                                ? 'bg-blue-600 ring-2 ring-blue-400 scale-110'
                                                : 'bg-slate-700/50 hover:bg-slate-600'
                                                }`}
                                        >
                                            {a}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {error && (
                        <div className="bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full font-bold py-3 px-8 rounded-xl text-lg shadow-lg transition-all active:scale-95 ${isLogin
                            ? 'bg-blue-600 hover:bg-blue-500 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {loading ? '...' : isLogin ? 'Login' : 'Create Account'}
                    </button>
                </form>

                <div className="mt-4 text-center">
                    <button
                        onClick={onGuest}
                        className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
                    >
                        Continue as Guest →
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthScreen;
