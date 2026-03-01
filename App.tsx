import React, { useState, useCallback, useEffect } from 'react';
import TrainingMode from './components/TrainingMode';
import PlayingMode from './components/PlayingMode';
import MultiplayerMode from './components/MultiplayerMode';
import AuthScreen from './components/AuthScreen';
import ProfilePage from './components/ProfilePage';
import Leaderboard from './components/Leaderboard';
import { UserProfile, fetchMe, getToken, setToken, clearToken } from './utils/api';

type Mode = 'menu' | 'auth' | 'training' | 'playing' | 'multiplayer' | 'profile' | 'leaderboard';

const App: React.FC = () => {
  const [mode, setModeRaw] = useState<Mode>(() => {
    const saved = sessionStorage.getItem('bj_mode');
    if (saved === 'training' || saved === 'playing' || saved === 'multiplayer') return saved;
    return 'menu';
  });

  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const setMode = useCallback((m: Mode) => {
    sessionStorage.setItem('bj_mode', m);
    setModeRaw(m);
  }, []);

  // Auto-login from stored JWT on mount
  useEffect(() => {
    const token = getToken();
    if (token) {
      fetchMe().then(u => {
        if (u) setUser(u);
        setAuthLoading(false);
      });
    } else {
      setAuthLoading(false);
    }
  }, []);

  const handleAuth = (u: UserProfile) => {
    setUser(u);
    setMode('menu');
  };

  const handleLogout = () => {
    clearToken();
    setUser(null);
    setMode('menu');
  };

  // Refresh user profile (after game results)
  const refreshUser = useCallback(() => {
    fetchMe().then(u => { if (u) setUser(u); });
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400 animate-pulse">Loading…</div>
      </div>
    );
  }

  if (mode === 'auth') {
    return <AuthScreen onAuth={handleAuth} onGuest={() => setMode('menu')} />;
  }

  if (mode === 'profile' && user) {
    return <ProfilePage user={user} onBack={() => { refreshUser(); setMode('menu'); }} onLogout={handleLogout} />;
  }

  if (mode === 'leaderboard') {
    return <Leaderboard onBack={() => setMode('menu')} myUserId={user?.id} />;
  }

  if (mode === 'training') {
    return <TrainingMode onBack={() => setMode('menu')} user={user} />;
  }

  if (mode === 'playing') {
    return <PlayingMode onBack={() => { refreshUser(); setMode('menu'); }} user={user} />;
  }

  if (mode === 'multiplayer') {
    return <MultiplayerMode onBack={() => { refreshUser(); setMode('menu'); }} user={user} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
      <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-md p-8 rounded-3xl shadow-2xl border border-slate-700">
        {/* User bar */}
        <div className="flex items-center justify-between mb-6">
          {user ? (
            <button onClick={() => setMode('profile')} className="flex items-center gap-2 bg-slate-700/40 hover:bg-slate-700/60 px-3 py-2 rounded-xl transition-colors">
              <span className="text-xl">{user.avatar}</span>
              <div className="text-left">
                <div className="text-white text-sm font-bold">{user.display_name}</div>
                <div className="text-emerald-400 text-xs font-mono">💰 {user.chips.toLocaleString()}</div>
              </div>
            </button>
          ) : (
            <button
              onClick={() => setMode('auth')}
              className="text-blue-400 hover:text-blue-300 text-sm font-bold transition-colors px-3 py-2"
            >
              Login / Register
            </button>
          )}
          <button
            onClick={() => setMode('leaderboard')}
            className="text-amber-400 hover:text-amber-300 text-sm font-bold transition-colors px-3 py-2"
          >
            🏆 Leaderboard
          </button>
        </div>

        <h1 className="text-4xl font-bold text-center text-white mb-2">Blackjack</h1>
        <p className="text-slate-400 text-center mb-10 tracking-widest uppercase text-sm">Master the Game</p>

        <div className="space-y-4">
          <button
            onClick={() => setMode('training')}
            className="w-full group relative bg-emerald-600 hover:bg-emerald-500 text-white p-6 rounded-xl shadow-lg transition-all hover:-translate-y-1 overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center justify-between">
              <div className="text-left">
                <div className="text-2xl font-bold">Training Mode</div>
                <div className="text-emerald-200 text-sm">Practice Basic Strategy</div>
              </div>
              <span className="text-4xl opacity-50 group-hover:opacity-100 transition-opacity">🎓</span>
            </div>
          </button>

          <button
            onClick={() => setMode('playing')}
            className="w-full group relative bg-blue-600 hover:bg-blue-500 text-white p-6 rounded-xl shadow-lg transition-all hover:-translate-y-1 overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center justify-between">
              <div className="text-left">
                <div className="text-2xl font-bold">Playing Mode</div>
                <div className="text-blue-200 text-sm">Full Game Loop</div>
              </div>
              <span className="text-4xl opacity-50 group-hover:opacity-100 transition-opacity">♠️</span>
            </div>
          </button>

          <button
            onClick={() => setMode('multiplayer')}
            className="w-full group relative bg-purple-600 hover:bg-purple-500 text-white p-6 rounded-xl shadow-lg transition-all hover:-translate-y-1 overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center justify-between">
              <div className="text-left">
                <div className="text-2xl font-bold">Multiplayer Mode</div>
                <div className="text-purple-200 text-sm">Play with Friends</div>
              </div>
              <span className="text-4xl opacity-50 group-hover:opacity-100 transition-opacity">👥</span>
            </div>
          </button>
        </div>

        <div className="mt-8 text-center text-slate-500 text-xs">
          v2.0 • H17 • 6 Decks • No Surrender
        </div>
      </div>
    </div>
  );
};

export default App;
