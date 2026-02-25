import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import Card from './Card';
import MultiplayerLobby from './MultiplayerLobby';
import { playSound, speak } from '../utils/sound';
import { calculateHandValue, isStrictPair } from '../utils/deck';
import { SerializedRoom, SerializedPlayer, Card as CardType } from '../types';

interface MultiplayerModeProps {
    onBack: () => void;
}

const CHIP_VALUES = [10, 25, 100, 500] as const;
// In dev, Socket.IO goes through Vite's proxy (same origin, port 3000).
// In production, set VITE_MP_SERVER to the deployed server URL.
const SERVER_URL = (import.meta as any).env?.VITE_MP_SERVER ?? '';

const MultiplayerMode: React.FC<MultiplayerModeProps> = ({ onBack }) => {
    const socketRef = useRef<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const [room, setRoom] = useState<SerializedRoom | null>(null);
    const [roomCode, setRoomCode] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [betAmount, setBetAmount] = useState(0);
    const [myId, setMyId] = useState<string | null>(null);
    const [message, setMessage] = useState('');

    // Deal animation state: -1 = no animation, 0+ = current step in reveal sequence
    const [dealStep, setDealStep] = useState(-1);
    const dealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Socket Connection ──
    useEffect(() => {
        const socket = io(SERVER_URL || undefined, { transports: ['websocket', 'polling'] });
        socketRef.current = socket;

        socket.on('connect', () => {
            setConnected(true);
            setMyId(socket.id ?? null);
            setError(null);
        });
        socket.on('disconnect', () => setConnected(false));
        socket.on('connect_error', () => {
            setError('Cannot connect to server. Check your network.');
        });
        socket.on('room-created', ({ code }: { code: string }) => setRoomCode(code));
        socket.on('room-joined', ({ code }: { code: string }) => setRoomCode(code));
        socket.on('room-update', (data: SerializedRoom) => setRoom(data));
        socket.on('error-msg', (msg: string) => setError(msg));

        return () => { socket.disconnect(); };
    }, []);

    // ── Sound effects based on phase transitions + deal animation ──
    const prevPhaseRef = useRef<string | null>(null);
    const prevActiveRef = useRef<string | null>(null);
    useEffect(() => {
        if (!room) return;
        const prev = prevPhaseRef.current;
        prevPhaseRef.current = room.phase;

        if (prev !== room.phase) {
            // Initial deal → start card-by-card animation
            if (room.phase === 'player_turns' && prev === 'betting') {
                const totalSteps = room.players.length * 2 + 2; // 2 cards per player + 2 dealer
                setDealStep(0);
                let step = 0;
                if (dealTimerRef.current) clearInterval(dealTimerRef.current);
                dealTimerRef.current = setInterval(() => {
                    step++;
                    if (step >= totalSteps) {
                        clearInterval(dealTimerRef.current!);
                        dealTimerRef.current = null;
                        setDealStep(-1);
                        // Announce only my total after deal completes
                        const mePlayer = room.players.find(p => p.socketId === myId);
                        if (mePlayer && mePlayer.hands[0]?.cards.length >= 2) {
                            const { total } = calculateHandValue(mePlayer.hands[0].cards);
                            if (total === 21) {
                                speak('Blackjack', 1.0, 1.3);
                            } else {
                                speak(`${total}`, 1.05, 1.05);
                            }
                        }
                    } else {
                        playSound('deal');
                        setDealStep(step);
                    }
                }, 400);
                playSound('deal'); // for the first card
            }
            if (room.phase === 'dealer_turn' && room.dealerHand.length >= 2) {
                // Dealer hole card revealed — speak total
                const { total: dTotal } = calculateHandValue(room.dealerHand);
                speak(`${dTotal}`, 1.3, 1.0);
            }
            if (room.phase === 'results') {
                const me = room.players.find(p => p.socketId === myId);
                if (me) {
                    const wins = me.hands.filter(h => h.result === 'win').length;
                    const losses = me.hands.filter(h => h.result === 'loss').length;
                    // Delay result sound so dealer total is heard first
                    setTimeout(() => {
                        if (wins > losses) playSound('win');
                        else if (losses > wins) playSound('loss');
                        else playSound('push');
                    }, 1500);
                }
            }
        }

        // Announce when active player changes to someone else
        if (room.phase === 'player_turns' && room.activePlayerId && room.activePlayerId !== myId) {
            const prevActive = prevActiveRef.current;
            if (room.activePlayerId !== prevActive) {
                const activePlayer = room.players.find(p => p.socketId === room.activePlayerId);
                if (activePlayer && activePlayer.hands.length > 0) {
                    const { total } = calculateHandValue(activePlayer.hands[0].cards);
                    speak(`${activePlayer.name}, ${total}`, 1.0, 1.0);
                }
            }
        }
        prevActiveRef.current = room.activePlayerId;

        return () => {
            if (dealTimerRef.current) clearInterval(dealTimerRef.current);
        };
    }, [room, myId]);

    // Helper: compute deal order index for a given card
    // Real blackjack order: round 1 (card 0) to all players then dealer, round 2 (card 1) to all players then dealer
    const getDealOrderIndex = useCallback((playerIndex: number, cardIndex: number, numPlayers: number): number => {
        return cardIndex * (numPlayers + 1) + playerIndex;
    }, []);
    const getDealerDealOrder = useCallback((cardIndex: number, numPlayers: number): number => {
        return cardIndex * (numPlayers + 1) + numPlayers;
    }, []);

    // ── Announce point totals when new cards are dealt (hits, splits, dealer draws) ──
    // Skipped during initial deal animation — that has its own announce logic above
    const prevCardCountsRef = useRef<Record<string, number>>({});
    useEffect(() => {
        if (!room || room.phase === 'betting' || room.phase === 'lobby') return;
        // Skip during deal animation
        if (dealStep >= 0) {
            // Still update counts so we don't false-trigger after animation ends
            const newCounts: Record<string, number> = {};
            for (const player of room.players) {
                newCounts[player.socketId] = player.hands.reduce((sum, h) => sum + h.cards.length, 0);
            }
            newCounts['__dealer__'] = room.dealerHand.length;
            prevCardCountsRef.current = newCounts;
            return;
        }

        const newCounts: Record<string, number> = {};
        const prev = prevCardCountsRef.current;
        const announcements: { text: string; rate: number; pitch: number }[] = [];

        // Check each player's hands
        for (const player of room.players) {
            const totalCards = player.hands.reduce((sum, h) => sum + h.cards.length, 0);
            newCounts[player.socketId] = totalCards;

            if (prev[player.socketId] !== undefined && totalCards > prev[player.socketId]) {
                for (const hand of player.hands) {
                    if (hand.cards.length > 0) {
                        const { total } = calculateHandValue(hand.cards);
                        if (total > 21) {
                            announcements.push({ text: `${total}, bust`, rate: 0.9, pitch: 0.75 });
                        } else if (total === 21 && hand.cards.length === 2) {
                            announcements.push({ text: 'Blackjack', rate: 1.0, pitch: 1.3 });
                        } else {
                            announcements.push({ text: `${total}`, rate: 1.0, pitch: 1.0 });
                        }
                    }
                }
            }
        }

        // Check dealer
        const dealerCards = room.dealerHand.length;
        newCounts['__dealer__'] = dealerCards;
        if (prev['__dealer__'] !== undefined && dealerCards > prev['__dealer__'] && dealerCards > 0) {
            const { total } = calculateHandValue(room.dealerHand);
            if (room.phase === 'dealer_turn' || room.phase === 'results') {
                if (total > 21) {
                    announcements.push({ text: `${total}, dealer busts`, rate: 1.1, pitch: 1.15 });
                } else {
                    announcements.push({ text: `${total}`, rate: 1.0, pitch: 1.0 });
                }
            }
        }

        prevCardCountsRef.current = newCounts;

        // Speak announcements with slight delay between each
        announcements.forEach(({ text, rate, pitch }, i) => {
            setTimeout(() => speak(text, rate, pitch), i * 700);
        });
    }, [room, myId, dealStep]);

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
                connected={connected}
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
        <div className="flex flex-col min-h-[100dvh] w-full overflow-auto">
            {/* Header */}
            <header className="sticky top-0 w-full bg-slate-800 border-b border-slate-700 p-2 sm:p-3 flex justify-between items-center z-20 shadow-md shrink-0">
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

            <main className="flex-1 w-full max-w-7xl mx-auto flex flex-col p-2 sm:p-4 overflow-auto">
                {/* Dealer Area */}
                {room.dealerHand.length > 0 && (
                    <div className="flex flex-col items-center mb-3 shrink-0">
                        <div className="text-slate-400 text-xs uppercase tracking-widest mb-1">Dealer</div>
                        <div className="flex gap-1 flex-wrap justify-center min-h-[72px] sm:min-h-[80px] items-center">
                            {room.dealerHand.map((card, i) => {
                                // During deal animation, check if this dealer card should be visible
                                const dealOrder = getDealerDealOrder(i, room.players.length);
                                const isHidden = dealStep >= 0 && dealOrder > dealStep;
                                const justDealt = dealStep >= 0 && dealOrder === dealStep;
                                return (
                                    <div key={card.id} className={`${justDealt ? 'animate-[dealCard_0.6s_ease-out]' : ''} ${isHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                                        <Card
                                            card={card}
                                            faceDown={i === 1 && !showDealerHole}
                                            className="w-12 h-16 sm:w-16 sm:h-24"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        {dealStep < 0 && (
                            <div className="mt-1 text-white font-mono text-base font-bold bg-slate-700/80 px-3 py-1 rounded-full">
                                {showDealerHole
                                    ? `${dealerTotal}${calculateHandValue(room.dealerHand).isSoft ? ' (Soft)' : ''}`
                                    : `${dealerUpTotal}`
                                }
                            </div>
                        )}
                    </div>
                )}

                {/* Divider */}
                {room.dealerHand.length > 0 && <div className="w-32 mx-auto border-t border-slate-700 mb-4" />}

                {/* ── Betting UI ── */}
                {room.phase === 'betting' && me && !me.hasBet && (
                    <div className="flex flex-col items-center gap-5 my-4">
                        <div className="text-slate-300 text-lg font-semibold tracking-wide">Place Your Bet</div>
                        <div className="flex gap-4 justify-center flex-wrap">
                            <div className="bg-slate-800/80 border border-slate-600 rounded-2xl px-8 py-5 text-center">
                                <div className="text-slate-400 text-xs uppercase tracking-widest mb-1">Balance</div>
                                <div className={`text-3xl font-bold font-mono ${me.chips >= 1000 ? 'text-emerald-400' : me.chips > 200 ? 'text-yellow-400' : 'text-red-400'}`}>💰 {me.chips.toLocaleString()}</div>
                            </div>
                            <div className="bg-slate-800/80 border border-slate-600 rounded-2xl px-8 py-5 text-center">
                                <div className="text-slate-400 text-xs uppercase tracking-widest mb-1">Current Bet</div>
                                <div className="text-3xl font-bold font-mono text-amber-300">{betAmount.toLocaleString()}</div>
                            </div>
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
                    <div className="flex flex-wrap gap-3 sm:gap-4 justify-center">
                        {room.players.map(player => {
                            const isMe = player.socketId === myId;
                            const isActive = room.activePlayerId === player.socketId && room.phase === 'player_turns';

                            return (
                                <div
                                    key={player.socketId}
                                    className={`flex flex-col items-center rounded-2xl p-3 sm:p-4 border-2 transition-all w-[260px] sm:w-[420px] min-h-[180px] sm:min-h-[300px] relative
                    ${isMe
                                            ? 'bg-blue-950/60 border-blue-400 shadow-[0_0_20px_rgba(96,165,250,0.4),0_0_40px_rgba(96,165,250,0.15)] ring-2 ring-blue-400/50 border-[3px]'
                                            : 'bg-slate-800/50 border-slate-700/50'}
                    ${isActive && !isMe ? 'border-amber-500 shadow-lg shadow-amber-500/20' : ''}
                    ${isActive && isMe ? 'border-blue-300 shadow-[0_0_25px_rgba(96,165,250,0.5)]' : ''}
                  `}
                                >
                                    {/* Player name + chips */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`font-bold text-sm ${isMe ? 'text-blue-300' : 'text-slate-300'}`}>
                                            {player.name}
                                        </span>
                                        {isActive && (
                                            <span className={`w-2.5 h-2.5 rounded-full animate-bounce ${isMe ? 'bg-blue-400' : 'bg-amber-400'}`} />
                                        )}
                                    </div>
                                    <span className={`text-xs font-mono mb-3 ${isMe ? 'text-blue-300/80' : 'text-slate-400'}`}>💰 {player.chips.toLocaleString()}</span>

                                    {/* Hands */}
                                    {player.hands.map((hand, hi) => {
                                        const { total, isSoft } = calculateHandValue(hand.cards);
                                        const bust = hand.status === 'busted';

                                        return (
                                            <div key={hand.id} className="flex flex-col items-center mb-2">
                                                <div className="flex relative min-h-[80px] sm:min-h-[88px] items-start">
                                                    {hand.cards.map((card, ci) => {
                                                        const playerIdx = room.players.findIndex(p => p.socketId === player.socketId);
                                                        const dealOrder = getDealOrderIndex(playerIdx, ci, room.players.length);
                                                        const isHidden = dealStep >= 0 && ci < 2 && dealOrder > dealStep;
                                                        const justDealt = dealStep >= 0 && ci < 2 && dealOrder === dealStep;
                                                        return (
                                                            <div
                                                                key={card.id}
                                                                style={{ marginLeft: ci > 0 ? '-25px' : '0', zIndex: ci }}
                                                                className={`relative ${justDealt ? 'animate-[dealCard_0.6s_ease-out]' : ''} ${isHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                                                            >
                                                                <Card card={card} className="w-12 h-16 sm:w-16 sm:h-24" />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {(() => {
                                                    // During deal animation, check if all initial cards are visible
                                                    if (dealStep >= 0) {
                                                        const playerIdx = room.players.findIndex(p => p.socketId === player.socketId);
                                                        const lastCardOrder = getDealOrderIndex(playerIdx, 1, room.players.length);
                                                        if (dealStep < lastCardOrder) return null;
                                                    }
                                                    return (
                                                        <div className="mt-1.5 flex gap-1.5 items-center justify-center flex-wrap">
                                                            <span className={`text-sm sm:text-base font-black font-mono px-2 py-0.5 rounded-md ${bust ? 'bg-red-600/50 text-red-200' : 'bg-slate-700/80 text-white'}`}>
                                                                {total}{bust ? ' BUST' : isSoft ? ' (S)' : ''}
                                                            </span>
                                                            {hand.result && (
                                                                <span className={`text-[10px] sm:text-xs font-bold uppercase px-1.5 py-0.5 rounded
                              ${hand.result === 'win' ? 'bg-emerald-600/40 text-emerald-300'
                                                                        : hand.result === 'loss' ? 'bg-red-600/40 text-red-300'
                                                                            : 'bg-slate-600/40 text-slate-300'
                                                                    }`}>
                                                                    {hand.result}
                                                                </span>
                                                            )}
                                                            <span className="text-amber-300/70 text-[10px] sm:text-xs">({hand.bet})</span>
                                                        </div>
                                                    );
                                                })()}

                                                {/* Action buttons — only for my active hand */}
                                                {isMe && isMyTurn && hand.status === 'playing' && room.phase === 'player_turns' && (
                                                    <div className="flex gap-3 sm:gap-4 mt-3 justify-center">
                                                        {hand.cards.length === 2 && me.chips >= hand.bet && (
                                                            <button onClick={() => handleAction('double', hi)} className="flex flex-col items-center gap-1">
                                                                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-yellow-500 hover:bg-yellow-400 active:scale-90 flex items-center justify-center shadow-lg transition-all">
                                                                    <span className="text-white font-black text-lg sm:text-xl">×2</span>
                                                                </div>
                                                                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">Double</span>
                                                            </button>
                                                        )}
                                                        <button onClick={() => handleAction('hit', hi)} className="flex flex-col items-center gap-1">
                                                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-90 flex items-center justify-center shadow-lg transition-all">
                                                                <span className="text-white text-2xl sm:text-3xl font-bold leading-none">+</span>
                                                            </div>
                                                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">Hit</span>
                                                        </button>
                                                        <button onClick={() => handleAction('stand', hi)} className="flex flex-col items-center gap-1">
                                                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-red-500 hover:bg-red-400 active:scale-90 flex items-center justify-center shadow-lg transition-all">
                                                                <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M10 2a1.5 1.5 0 0 1 1.5 1.5V9h1V4.5a1.5 1.5 0 0 1 3 0V9h1V5.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7H11a7 7 0 0 1-7-7v-3.5a1.5 1.5 0 0 1 3 0V13h1V3.5A1.5 1.5 0 0 1 10 2Z" /></svg>
                                                            </div>
                                                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">Stand</span>
                                                        </button>
                                                        {isStrictPair(hand.cards) && player.hands.length < 4 && me.chips >= hand.bet && (
                                                            <button onClick={() => handleAction('split', hi)} className="flex flex-col items-center gap-1">
                                                                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-purple-500 hover:bg-purple-400 active:scale-90 flex items-center justify-center shadow-lg transition-all">
                                                                    <span className="text-white font-black text-lg sm:text-xl">↔</span>
                                                                </div>
                                                                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">Split</span>
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
