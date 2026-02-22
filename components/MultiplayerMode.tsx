import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import Card from './Card';
import MultiplayerLobby from './MultiplayerLobby';
import { playSound } from '../utils/sound';
import { calculateHandValue, isStrictPair } from '../utils/deck';
import { SerializedRoom, SerializedPlayer, Card as CardType } from '../types';

interface MultiplayerModeProps {
    onBack: () => void;
}

const CHIP_VALUES = [10, 25, 100, 500] as const;
const SERVER_URL = (import.meta as any).env?.VITE_MP_SERVER ?? 'http://localhost:3001';

const MultiplayerMode: React.FC<MultiplayerModeProps> = ({ onBack }) => {
    const socketRef = useRef<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const [room, setRoom] = useState<SerializedRoom | null>(null);
    const [roomCode, setRoomCode] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [betAmount, setBetAmount] = useState(0);
    const [myId, setMyId] = useState<string | null>(null);
    const [message, setMessage] = useState('');

    // ── Socket Connection ──
    useEffect(() => {
        const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });
        socketRef.current = socket;

        socket.on('connect', () => {
            setConnected(true);
            setMyId(socket.id ?? null);
        });
        socket.on('disconnect', () => setConnected(false));
        socket.on('room-created', ({ code }: { code: string }) => setRoomCode(code));
        socket.on('room-joined', ({ code }: { code: string }) => setRoomCode(code));
        socket.on('room-update', (data: SerializedRoom) => setRoom(data));
        socket.on('error-msg', (msg: string) => setError(msg));

        return () => { socket.disconnect(); };
    }, []);

    // ── Sound effects based on phase transitions ──
    const prevPhaseRef = useRef<string | null>(null);
    useEffect(() => {
        if (!room) return;
        const prev = prevPhaseRef.current;
        prevPhaseRef.current = room.phase;

        if (prev !== room.phase) {
            if (room.phase === 'player_turns' && prev === 'betting') playSound('deal');
            if (room.phase === 'results') {
                const me = room.players.find(p => p.socketId === myId);
                if (me) {
                    const wins = me.hands.filter(h => h.result === 'win').length;
                    const losses = me.hands.filter(h => h.result === 'loss').length;
                    if (wins > losses) playSound('win');
                    else if (losses > wins) playSound('loss');
                    else playSound('push');
                }
            }
        }
    }, [room, myId]);

    // ── Actions ──
    const emit = useCallback((event: string, data: Record<string, unknown>) => {
        socketRef.current?.emit(event, data);
    }, []);

    const handleCreateRoom = (name: string) => {
        setError(null);
        emit('create-room', { name });
    };

    const handleJoinRoom = (name: string, code: string) => {
        setError(null);
        emit('join-room', { code, name });
    };

    const handleStartGame = () => {
        if (!roomCode) return;
        emit('start-game', { code: roomCode });
    };

    const handlePlaceBet = () => {
        if (!roomCode || betAmount <= 0) return;
        emit('place-bet', { code: roomCode, amount: betAmount });
        setBetAmount(0);
    };

    const handleAction = (action: string, handIndex?: number) => {
        if (!roomCode) return;
        playSound('click');
        emit('player-action', { code: roomCode, action, handIndex: handIndex ?? 0 });
    };

    const handleNextRound = () => {
        if (!roomCode) return;
        playSound('click');
        emit('next-round', { code: roomCode });
    };

    const handleLeave = () => {
        socketRef.current?.disconnect();
        onBack();
    };

    // ── Loading / Lobby ──
    if (!room) {
        return (
            <MultiplayerLobby
                onCreateRoom={handleCreateRoom}
                onJoinRoom={handleJoinRoom}
                roomCode={roomCode}
                error={error}
                onBack={handleLeave}
            />
        );
    }

    // ── Derived state ──
    const me = room.players.find(p => p.socketId === myId);
    const isHost = room.hostId === myId;
    const isMyTurn = room.activePlayerId === myId;
    const dealerTotal = room.dealerHand.length > 0 ? calculateHandValue(room.dealerHand).total : 0;
    const dealerUpTotal = room.dealerHand.length > 0 ? calculateHandValue([room.dealerHand[0]]).total : 0;
    const showDealerHole = room.phase !== 'player_turns';

    // ── Lobby phase ──
    if (room.phase === 'lobby') {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
                <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-md p-8 rounded-3xl shadow-2xl border border-slate-700">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-white">Room Lobby</h2>
                        <div className="bg-slate-700/60 px-4 py-2 rounded-xl">
                            <span className="text-slate-400 text-xs uppercase tracking-widest">Code </span>
                            <span className="text-emerald-400 font-mono font-bold text-xl tracking-widest">{room.code}</span>
                        </div>
                    </div>

                    <div className="mb-6">
                        <div className="text-slate-400 text-xs uppercase tracking-widest mb-3">Players ({room.players.length})</div>
                        <div className="space-y-2">
                            {room.players.map(p => (
                                <div key={p.socketId} className="flex items-center justify-between bg-slate-700/40 px-4 py-3 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${p.socketId === room.hostId ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                                        <span className="text-white font-medium">{p.name}</span>
                                        {p.socketId === room.hostId && (
                                            <span className="text-amber-400 text-xs font-bold uppercase">Host</span>
                                        )}
                                        {p.socketId === myId && (
                                            <span className="text-blue-400 text-xs font-bold uppercase">You</span>
                                        )}
                                    </div>
                                    <span className="text-slate-400 font-mono text-sm">💰 {p.chips}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        {isHost && room.players.length >= 1 && (
                            <button
                                onClick={handleStartGame}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-4 px-8 rounded-xl text-lg shadow-lg transition-all"
                            >
                                Start Game 🃏
                            </button>
                        )}
                        {!isHost && (
                            <div className="text-center text-slate-400 text-sm animate-pulse">
                                Waiting for host to start the game…
                            </div>
                        )}
                        <button
                            onClick={handleLeave}
                            className="w-full text-slate-400 hover:text-red-400 text-sm transition-colors py-2"
                        >
                            Leave Room
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Game view ──
    return (
        <div className="flex flex-col h-full w-full">
            {/* Header */}
            <header className="w-full bg-slate-800 border-b border-slate-700 p-3 flex justify-between items-center z-10 shadow-md">
                <div className="flex items-center gap-3">
                    <button onClick={handleLeave} className="text-slate-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div className="bg-slate-700/60 px-3 py-1 rounded-lg">
                        <span className="text-slate-400 text-xs">Room </span>
                        <span className="text-emerald-400 font-mono font-bold tracking-wider">{room.code}</span>
                    </div>
                </div>
                <div className="flex gap-4 items-center">
                    {me && (
                        <div className="flex flex-col items-end">
                            <span className="text-slate-400 text-xs uppercase tracking-wider">Balance</span>
                            <span className={`text-lg font-bold font-mono ${me.chips >= 1000 ? 'text-emerald-400' : me.chips > 200 ? 'text-yellow-400' : 'text-red-400'}`}>
                                💰 {me.chips.toLocaleString()}
                            </span>
                        </div>
                    )}
                    <div className="flex flex-col items-end">
                        <span className="text-slate-400 text-xs uppercase tracking-wider">Phase</span>
                        <span className="text-blue-400 text-sm font-bold uppercase">
                            {room.phase === 'betting' ? 'Betting' :
                                room.phase === 'player_turns' ? 'Playing' :
                                    room.phase === 'dealer_turn' ? 'Dealer' :
                                        room.phase === 'results' ? 'Results' : room.phase}
                        </span>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-6xl mx-auto flex flex-col p-4 overflow-auto">
                {/* Dealer Area */}
                {room.dealerHand.length > 0 && (
                    <div className="flex flex-col items-center mb-4 shrink-0">
                        <div className="text-slate-400 text-xs uppercase tracking-widest mb-2">Dealer</div>
                        <div className="flex gap-2 flex-wrap justify-center">
                            {room.dealerHand.map((card, i) => (
                                <Card
                                    key={card.id}
                                    card={card}
                                    faceDown={i === 1 && !showDealerHole}
                                />
                            ))}
                        </div>
                        <div className="mt-1 text-slate-300 font-mono text-sm">
                            {showDealerHole
                                ? `Total: ${dealerTotal}${calculateHandValue(room.dealerHand).isSoft ? ' (Soft)' : ''}`
                                : `Showing: ${dealerUpTotal}`
                            }
                        </div>
                    </div>
                )}

                {/* Divider */}
                {room.dealerHand.length > 0 && <div className="w-32 mx-auto border-t border-slate-700 mb-4" />}

                {/* ── Betting UI ── */}
                {room.phase === 'betting' && me && !me.hasBet && (
                    <div className="flex flex-col items-center gap-5 my-4">
                        <div className="text-slate-300 text-lg font-semibold tracking-wide">Place Your Bet</div>
                        <div className="bg-slate-800/80 border border-slate-600 rounded-2xl px-10 py-5 text-center">
                            <div className="text-slate-400 text-xs uppercase tracking-widest mb-1">Current Bet</div>
                            <div className="text-4xl font-bold font-mono text-amber-300">{betAmount.toLocaleString()}</div>
                        </div>
                        <div className="flex gap-3 flex-wrap justify-center">
                            {CHIP_VALUES.map(val => (
                                <button
                                    key={val}
                                    onClick={() => { playSound('click'); setBetAmount(prev => Math.min(prev + val, me.chips)); }}
                                    disabled={betAmount + val > me.chips}
                                    className={`relative w-16 h-16 rounded-full font-bold text-sm shadow-lg transition-all active:scale-90
                    ${betAmount + val > me.chips
                                            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                            : val === 500
                                                ? 'bg-purple-600 hover:bg-purple-500 text-white border-2 border-purple-400'
                                                : val === 100
                                                    ? 'bg-black hover:bg-gray-800 text-white border-2 border-gray-400'
                                                    : val === 25
                                                        ? 'bg-green-600 hover:bg-green-500 text-white border-2 border-green-400'
                                                        : 'bg-blue-600 hover:bg-blue-500 text-white border-2 border-blue-400'
                                        }`}
                                >
                                    {val}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={() => { playSound('click'); setBetAmount(0); }}
                                disabled={betAmount === 0}
                                className="bg-slate-600 hover:bg-slate-500 disabled:bg-slate-800 disabled:text-slate-600 active:scale-95 text-white font-bold py-3 px-8 rounded-xl transition-all"
                            >
                                Clear
                            </button>
                            <button
                                onClick={() => { playSound('click'); handlePlaceBet(); }}
                                disabled={betAmount === 0}
                                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 active:scale-95 text-white font-bold py-3 px-10 rounded-xl text-lg transition-all"
                            >
                                Deal 🃏
                            </button>
                        </div>
                    </div>
                )}

                {room.phase === 'betting' && me && me.hasBet && (
                    <div className="text-center text-slate-400 text-sm animate-pulse my-6">
                        Waiting for other players to place their bets…
                    </div>
                )}

                {/* ── All Player Hands ── */}
                {(room.phase === 'player_turns' || room.phase === 'dealer_turn' || room.phase === 'results') && (
                    <div className="flex flex-wrap gap-6 justify-center">
                        {room.players.map(player => {
                            const isMe = player.socketId === myId;
                            const isActive = room.activePlayerId === player.socketId && room.phase === 'player_turns';

                            return (
                                <div
                                    key={player.socketId}
                                    className={`flex flex-col items-center bg-slate-800/50 rounded-2xl p-4 border transition-all min-w-[180px]
                    ${isActive ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-slate-700/50'}
                    ${isMe ? 'ring-1 ring-blue-400/30' : ''}
                  `}
                                >
                                    {/* Player name + chips */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`font-bold text-sm ${isMe ? 'text-blue-400' : 'text-slate-300'}`}>
                                            {player.name}
                                            {isMe && ' (You)'}
                                        </span>
                                        {isActive && (
                                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                                        )}
                                    </div>
                                    <span className="text-slate-400 text-xs font-mono mb-3">💰 {player.chips.toLocaleString()}</span>

                                    {/* Hands */}
                                    {player.hands.map((hand, hi) => {
                                        const { total, isSoft } = calculateHandValue(hand.cards);
                                        const bust = hand.status === 'busted';

                                        return (
                                            <div key={hand.id} className="flex flex-col items-center mb-3">
                                                <div className="flex relative">
                                                    {hand.cards.map((card, ci) => (
                                                        <div
                                                            key={card.id}
                                                            style={{ marginLeft: ci > 0 ? '-25px' : '0', zIndex: ci }}
                                                            className="relative"
                                                        >
                                                            <Card card={card} />
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mt-1 font-mono text-xs font-bold flex gap-2 items-center">
                                                    <span className={bust ? 'text-red-400' : 'text-slate-300'}>
                                                        {total}{bust ? ' BUST' : isSoft ? ' (Soft)' : ''}
                                                    </span>
                                                    {hand.result && (
                                                        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded
                              ${hand.result === 'win' ? 'bg-emerald-600/40 text-emerald-300'
                                                                : hand.result === 'loss' ? 'bg-red-600/40 text-red-300'
                                                                    : 'bg-slate-600/40 text-slate-300'
                                                            }`}>
                                                            {hand.result}
                                                        </span>
                                                    )}
                                                    <span className="text-amber-300/70 text-xs">({hand.bet})</span>
                                                </div>

                                                {/* Action buttons — only for my active hand */}
                                                {isMe && isMyTurn && hand.status === 'playing' && room.phase === 'player_turns' && (
                                                    <div className="flex gap-2 mt-2">
                                                        <button
                                                            onClick={() => handleAction('hit', hi)}
                                                            className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-2 px-4 rounded-lg text-xs uppercase tracking-wider transition-all"
                                                        >
                                                            Hit
                                                        </button>
                                                        <button
                                                            onClick={() => handleAction('stand', hi)}
                                                            className="bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold py-2 px-4 rounded-lg text-xs uppercase tracking-wider transition-all"
                                                        >
                                                            Stand
                                                        </button>
                                                        {hand.cards.length === 2 && me.chips >= hand.bet && (
                                                            <button
                                                                onClick={() => handleAction('double', hi)}
                                                                className="bg-yellow-600 hover:bg-yellow-500 active:scale-95 text-white font-bold py-2 px-4 rounded-lg text-xs uppercase tracking-wider transition-all"
                                                            >
                                                                Dbl
                                                            </button>
                                                        )}
                                                        {isStrictPair(hand.cards) && player.hands.length < 4 && me.chips >= hand.bet && (
                                                            <button
                                                                onClick={() => handleAction('split', hi)}
                                                                className="bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold py-2 px-4 rounded-lg text-xs uppercase tracking-wider transition-all"
                                                            >
                                                                Split
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Waiting indicator during someone else's turn */}
                {room.phase === 'player_turns' && !isMyTurn && (
                    <div className="text-center text-slate-400 text-sm animate-pulse mt-4">
                        {(() => {
                            const active = room.players.find(p => p.socketId === room.activePlayerId);
                            return active ? `Waiting for ${active.name} to play…` : 'Waiting…';
                        })()}
                    </div>
                )}

                {/* Dealer playing indicator */}
                {room.phase === 'dealer_turn' && (
                    <div className="text-center text-slate-400 text-sm animate-pulse mt-4 uppercase tracking-widest">
                        Dealer playing…
                    </div>
                )}

                {/* Results footer */}
                {room.phase === 'results' && (
                    <div className="flex flex-col items-center gap-3 mt-6">
                        {me && (() => {
                            const wins = me.hands.filter(h => h.result === 'win').length;
                            const losses = me.hands.filter(h => h.result === 'loss').length;
                            if (wins > losses) return <div className="text-2xl font-bold text-emerald-400">🎉 You Win!</div>;
                            if (losses > wins) return <div className="text-2xl font-bold text-red-400">💸 You Lose</div>;
                            return <div className="text-2xl font-bold text-slate-300">🤝 Push</div>;
                        })()}

                        {isHost && (
                            <button
                                onClick={handleNextRound}
                                className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold py-4 px-14 rounded-xl text-xl shadow-lg transition-all"
                            >
                                Next Round
                            </button>
                        )}
                        {!isHost && (
                            <div className="text-slate-400 text-sm animate-pulse">
                                Waiting for host to start next round…
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default MultiplayerMode;
