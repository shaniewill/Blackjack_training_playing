import React, { useState } from 'react';

interface MultiplayerLobbyProps {
    onCreateRoom: (name: string) => void;
    onJoinRoom: (name: string, code: string) => void;
    roomCode: string | null;
    error: string | null;
    connected: boolean;
    onBack: () => void;
    userName?: string;  // pre-filled from logged-in user
}

const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
    onCreateRoom, onJoinRoom, roomCode, error, connected, onBack, userName,
}) => {
    const [name, setName] = useState(userName || '');
    const [code, setCode] = useState('');
    const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');

    const nameValid = name.trim().length >= 1 && connected;
    const isLoggedIn = !!userName;

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
            <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-md p-8 rounded-3xl shadow-2xl border border-slate-700">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <h2 className="text-2xl font-bold text-white">Multiplayer</h2>
                    <div className={`w-3 h-3 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`}
                        title={connected ? 'Connected' : 'Connecting…'} />
                </div>

                {/* Name — auto-filled badge for logged-in users, input for guests */}
                <div className="mb-6">
                    {isLoggedIn ? (
                        <div className="flex items-center gap-2 bg-slate-700/40 px-4 py-3 rounded-xl">
                            <span className="text-slate-400 text-xs uppercase tracking-widest">Playing as</span>
                            <span className="text-white font-bold">{name}</span>
                        </div>
                    ) : (
                        <>
                            <label className="text-slate-400 text-xs uppercase tracking-widest mb-2 block">Your Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Enter your name"
                                maxLength={16}
                                className="w-full bg-slate-700/60 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg
                  placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                            />
                        </>
                    )}
                </div>

                {error && (
                    <div className="bg-red-600/20 border border-red-500/40 rounded-xl px-4 py-3 mb-4 text-red-300 text-sm">
                        {error}
                    </div>
                )}

                {mode === 'choose' && (
                    <div className="space-y-3">
                        <button
                            onClick={() => setMode('create')}
                            disabled={!nameValid}
                            className="w-full group relative bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500
                text-white p-5 rounded-xl shadow-lg transition-all hover:-translate-y-0.5 overflow-hidden"
                        >
                            <div className="flex items-center justify-between">
                                <div className="text-left">
                                    <div className="text-xl font-bold">Create Room</div>
                                    <div className="text-emerald-200 text-sm">Get a code for friends</div>
                                </div>
                                <span className="text-3xl opacity-60 group-hover:opacity-100 transition-opacity">🏠</span>
                            </div>
                        </button>

                        <button
                            onClick={() => setMode('join')}
                            disabled={!nameValid}
                            className="w-full group relative bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500
                text-white p-5 rounded-xl shadow-lg transition-all hover:-translate-y-0.5 overflow-hidden"
                        >
                            <div className="flex items-center justify-between">
                                <div className="text-left">
                                    <div className="text-xl font-bold">Join Room</div>
                                    <div className="text-blue-200 text-sm">Enter a 4-digit code</div>
                                </div>
                                <span className="text-3xl opacity-60 group-hover:opacity-100 transition-opacity">🔗</span>
                            </div>
                        </button>
                    </div>
                )}

                {mode === 'create' && (
                    <div className="space-y-4">
                        {roomCode ? (
                            <div className="text-center space-y-4">
                                <div className="text-slate-400 text-sm uppercase tracking-widest">Your Room Code</div>
                                <div className="text-6xl font-bold font-mono text-emerald-400 tracking-[0.3em] bg-slate-700/50 py-6 rounded-2xl">
                                    {roomCode}
                                </div>
                                <div className="text-slate-400 text-sm">Share this code with friends to join</div>
                            </div>
                        ) : (
                            <button
                                onClick={() => onCreateRoom(name.trim())}
                                disabled={!nameValid}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500
                  active:scale-95 text-white font-bold py-4 px-8 rounded-xl text-lg shadow-lg transition-all"
                            >
                                Create Room 🚀
                            </button>
                        )}
                        <button
                            onClick={() => { setMode('choose'); }}
                            className="w-full text-slate-400 hover:text-white text-sm transition-colors py-2"
                        >
                            ← Back
                        </button>
                    </div>
                )}

                {mode === 'join' && (
                    <div className="space-y-4">
                        <div>
                            <label className="text-slate-400 text-xs uppercase tracking-widest mb-2 block">Room Code</label>
                            <input
                                type="text"
                                value={code}
                                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                placeholder="1234"
                                maxLength={4}
                                className="w-full bg-slate-700/60 border border-slate-600 rounded-xl px-4 py-4 text-white text-3xl text-center
                  font-mono tracking-[0.5em] placeholder-slate-600 focus:outline-none focus:border-blue-500
                  focus:ring-1 focus:ring-blue-500 transition-all"
                            />
                        </div>
                        <button
                            onClick={() => onJoinRoom(name.trim(), code)}
                            disabled={!nameValid || code.length !== 4}
                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500
                active:scale-95 text-white font-bold py-4 px-8 rounded-xl text-lg shadow-lg transition-all"
                        >
                            Join Room 🔗
                        </button>
                        <button
                            onClick={() => { setMode('choose'); setCode(''); }}
                            className="w-full text-slate-400 hover:text-white text-sm transition-colors py-2"
                        >
                            ← Back
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MultiplayerLobby;
