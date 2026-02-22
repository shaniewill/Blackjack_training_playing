import React, { useState } from 'react';
import TrainingMode from './components/TrainingMode';
import PlayingMode from './components/PlayingMode';
import MultiplayerMode from './components/MultiplayerMode';

type Mode = 'menu' | 'training' | 'playing' | 'multiplayer';

const App: React.FC = () => {
  const [mode, setMode] = useState<Mode>('menu');

  if (mode === 'training') {
    return <TrainingMode onBack={() => setMode('menu')} />;
  }

  if (mode === 'playing') {
    return <PlayingMode onBack={() => setMode('menu')} />;
  }

  if (mode === 'multiplayer') {
    return <MultiplayerMode onBack={() => setMode('menu')} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
      <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-md p-8 rounded-3xl shadow-2xl border border-slate-700">
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
          v1.1 • H17 • 6 Decks • No Surrender
        </div>
      </div>
    </div>
  );
};

export default App;
