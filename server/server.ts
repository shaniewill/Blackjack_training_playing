import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import authRouter, { verifyToken } from './auth.js';
import { recordGame, recordTraining, updateChips, findUserById } from './db.js';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Card {
    suit: string;
    rank: string;
    value: number;
    id: string;
}

interface PlayerHand {
    id: string;
    cards: Card[];
    bet: number;
    status: 'playing' | 'standing' | 'busted' | 'blackjack' | 'doubled';
    result?: 'win' | 'loss' | 'push';
}

interface RoomPlayer {
    playerId: string;      // stable UUID from client
    socketId: string;      // current socket.id (changes on reconnect)
    name: string;
    chips: number;
    hands: PlayerHand[];
    currentBet: number;
    hasBet: boolean;
    isDone: boolean;
    disconnected: boolean; // true during grace period
}

type RoomPhase = 'lobby' | 'betting' | 'player_turns' | 'dealer_turn' | 'results';

interface Room {
    code: string;
    hostId: string;        // now stores playerId, not socket.id
    phase: RoomPhase;
    players: Map<string, RoomPlayer>; // keyed by playerId
    deck: Card[];
    dealerHand: Card[];
    activePlayerId: string | null; // playerId of whose turn it is
}

// ─── Deck helpers ─────────────────────────────────────────────────────────────
const SUITS = ['♥', '♦', '♣', '♠'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function cardValue(rank: string): number {
    if (rank === 'A') return 11;
    if (['K', 'Q', 'J'].includes(rank)) return 10;
    return parseInt(rank);
}

function createDeck(numDecks: number): Card[] {
    const cards: Card[] = [];
    for (let d = 0; d < numDecks; d++) {
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                cards.push({ suit, rank, value: cardValue(rank), id: `${suit}${rank}-${d}-${Math.random().toString(36).slice(2, 7)}` });
            }
        }
    }
    return cards;
}

function shuffleDeck(cards: Card[]): Card[] {
    const arr = [...cards];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function calculateHandValue(cards: Card[]): { total: number; isSoft: boolean } {
    let total = 0;
    let aces = 0;
    for (const c of cards) {
        total += c.value;
        if (c.rank === 'A') aces++;
    }
    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }
    return { total, isSoft: aces > 0 };
}

function isStrictPair(cards: Card[]): boolean {
    return cards.length === 2 && cards[0].rank === cards[1].rank;
}

function drawCard(room: Room): Card {
    if (room.deck.length < 20) {
        room.deck = shuffleDeck(createDeck(6));
    }
    return room.deck.pop()!;
}

// ─── Room management ──────────────────────────────────────────────────────────
const rooms = new Map<string, Room>();
const STARTING_CHIPS = 1000;
const DISCONNECT_GRACE_MS = 30_000; // 30 seconds

// Reverse lookups
const playerIdToRoomCode = new Map<string, string>();   // playerId → room code
const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>(); // playerId → timer

function generateCode(): string {
    let code: string;
    do {
        code = String(Math.floor(1000 + Math.random() * 9000));
    } while (rooms.has(code));
    return code;
}

/** Find which playerId a socket belongs to */
function findPlayerIdBySocket(socketId: string): { playerId: string; room: Room } | null {
    for (const [_code, room] of rooms) {
        for (const [pid, player] of room.players) {
            if (player.socketId === socketId) {
                return { playerId: pid, room };
            }
        }
    }
    return null;
}

function serializeRoom(room: Room) {
    const players = Array.from(room.players.entries()).map(([pid, p]) => ({
        playerId: pid,
        socketId: p.socketId,
        name: p.name,
        chips: p.chips,
        hands: p.hands,
        currentBet: p.currentBet,
        hasBet: p.hasBet,
        isDone: p.isDone,
        disconnected: p.disconnected,
    }));
    return {
        code: room.code,
        hostId: room.hostId,
        phase: room.phase,
        players,
        dealerHand: room.dealerHand,
        activePlayerId: room.activePlayerId,
    };
}

/** Remove a player permanently and handle cleanup */
function removePlayer(playerId: string, room: Room) {
    const wasActive = room.activePlayerId === playerId;
    room.players.delete(playerId);
    playerIdToRoomCode.delete(playerId);

    if (room.players.size === 0) {
        rooms.delete(room.code);
        return;
    }

    // Transfer host if needed
    if (room.hostId === playerId) {
        // Prefer a connected player as host
        const connectedPlayer = Array.from(room.players.values()).find(p => !p.disconnected);
        room.hostId = connectedPlayer
            ? connectedPlayer.playerId
            : room.players.keys().next().value!;
    }

    io.to(room.code).emit('room-update', serializeRoom(room));

    // If it was their turn, advance
    if (wasActive && room.phase === 'player_turns') {
        advanceToNextPlayer(room);
        io.to(room.code).emit('room-update', serializeRoom(room));
    }
}

// ─── Server setup ─────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());
app.use(authRouter);
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.get('/health', (_req, res) => { res.json({ ok: true }); });

// ─── Socket handlers ──────────────────────────────────────────────────────────
io.on('connection', (socket: Socket) => {
    console.log(`[connect] ${socket.id}`);

    // ── Create Room ──
    socket.on('create-room', ({ name, playerId }: { name: string; playerId: string }) => {
        const code = generateCode();
        const room: Room = {
            code,
            hostId: playerId,
            phase: 'lobby',
            players: new Map(),
            deck: shuffleDeck(createDeck(6)),
            dealerHand: [],
            activePlayerId: null,
        };
        room.players.set(playerId, {
            playerId,
            socketId: socket.id,
            name,
            chips: STARTING_CHIPS,
            hands: [],
            currentBet: 0,
            hasBet: false,
            isDone: false,
            disconnected: false,
        });
        rooms.set(code, room);
        playerIdToRoomCode.set(playerId, code);
        socket.join(code);
        socket.emit('room-created', { code });
        io.to(code).emit('room-update', serializeRoom(room));
    });

    // ── Join Room ──
    socket.on('join-room', ({ code, name, playerId }: { code: string; name: string; playerId: string }) => {
        const room = rooms.get(code);
        if (!room) { socket.emit('error-msg', 'Room not found'); return; }
        if (room.phase !== 'lobby') { socket.emit('error-msg', 'Game already in progress'); return; }
        if (room.players.size >= 7) { socket.emit('error-msg', 'Room is full (max 7)'); return; }
        if (room.players.has(playerId)) { socket.emit('error-msg', 'Already in this room'); return; }

        room.players.set(playerId, {
            playerId,
            socketId: socket.id,
            name,
            chips: STARTING_CHIPS,
            hands: [],
            currentBet: 0,
            hasBet: false,
            isDone: false,
            disconnected: false,
        });
        playerIdToRoomCode.set(playerId, code);
        socket.join(code);
        socket.emit('room-joined', { code });
        io.to(code).emit('room-update', serializeRoom(room));
    });

    // ── Rejoin Room (reconnect after refresh/disconnect) ──
    socket.on('rejoin-room', ({ playerId, code }: { playerId: string; code: string }) => {
        const room = rooms.get(code);
        if (!room) {
            socket.emit('rejoin-failed', 'Room no longer exists');
            return;
        }

        const player = room.players.get(playerId);
        if (!player) {
            socket.emit('rejoin-failed', 'You are no longer in this room');
            return;
        }

        // Clear any pending disconnect timer
        const timer = disconnectTimers.get(playerId);
        if (timer) {
            clearTimeout(timer);
            disconnectTimers.delete(playerId);
        }

        // Update socket reference
        player.socketId = socket.id;
        player.disconnected = false;

        socket.join(code);
        console.log(`[rejoin] ${player.name} (${playerId}) rejoined room ${code}`);

        socket.emit('rejoin-success', { code });
        io.to(code).emit('room-update', serializeRoom(room));
    });

    // ── Start Game (host only) ──
    socket.on('start-game', ({ code }: { code: string }) => {
        const room = rooms.get(code);
        const found = findPlayerIdBySocket(socket.id);
        if (!room || !found || room.hostId !== found.playerId) return;
        if (room.players.size < 1) return;

        room.phase = 'betting';
        for (const p of room.players.values()) {
            p.hasBet = false;
            p.currentBet = 0;
            p.hands = [];
            p.isDone = false;
        }
        room.dealerHand = [];
        io.to(code).emit('room-update', serializeRoom(room));
    });

    // ── Place Bet ──
    socket.on('place-bet', ({ code, amount }: { code: string; amount: number }) => {
        const room = rooms.get(code);
        if (!room || room.phase !== 'betting') return;
        const found = findPlayerIdBySocket(socket.id);
        if (!found) return;
        const player = room.players.get(found.playerId);
        if (!player || player.hasBet) return;
        if (amount <= 0 || amount > player.chips) return;

        player.currentBet = amount;
        player.chips -= amount;
        player.hasBet = true;

        io.to(code).emit('room-update', serializeRoom(room));

        // Check if all connected players have bet
        const allBet = Array.from(room.players.values()).every(p => p.hasBet || p.disconnected);
        if (allBet) {
            dealRound(room);
        }
    });

    // ── Player Action ──
    socket.on('player-action', ({ code, action, handIndex }: { code: string; action: string; handIndex?: number }) => {
        const room = rooms.get(code);
        if (!room || room.phase !== 'player_turns') return;
        const found = findPlayerIdBySocket(socket.id);
        if (!found || room.activePlayerId !== found.playerId) return;
        const player = room.players.get(found.playerId);
        if (!player) return;

        const hi = handIndex ?? 0;
        const hand = player.hands[hi];
        if (!hand || hand.status !== 'playing') return;

        switch (action) {
            case 'hit': handleHit(room, player, hi); break;
            case 'stand': handleStand(room, player, hi); break;
            case 'double': handleDouble(room, player, hi); break;
            case 'split': handleSplit(room, player, hi); break;
        }
        io.to(code).emit('room-update', serializeRoom(room));

        // Check if current player's all hands are done
        const allHandsDone = player.hands.every(h => h.status !== 'playing');
        if (allHandsDone) {
            player.isDone = true;
            advanceToNextPlayer(room);
        }
    });

    // ── Next Round (host) ──
    socket.on('next-round', ({ code }: { code: string }) => {
        const room = rooms.get(code);
        const found = findPlayerIdBySocket(socket.id);
        if (!room || !found || room.hostId !== found.playerId) return;

        // Remove any players still disconnected at round boundary
        for (const [pid, p] of room.players) {
            if (p.disconnected) {
                removePlayer(pid, room);
            }
        }

        room.phase = 'betting';
        room.dealerHand = [];
        room.activePlayerId = null;
        for (const p of room.players.values()) {
            p.hasBet = false;
            p.currentBet = 0;
            p.hands = [];
            p.isDone = false;
        }
        io.to(code).emit('room-update', serializeRoom(room));
    });

    // ── Save single-player round result (logged-in users) ──
    socket.on('save-sp-result', (data: {
        token: string;
        handsPlayed: number; handsWon: number; handsLost: number;
        handsPushed: number; blackjacks: number; chipsDelta: number; totalChips: number;
    }) => {
        const payload = verifyToken(data.token);
        if (!payload) return;
        recordGame(payload.userId, 'playing', data.handsPlayed, data.handsWon,
            data.handsLost, data.handsPushed, data.blackjacks, data.chipsDelta);
        updateChips(payload.userId, data.totalChips);
    });

    // ── Save training result (logged-in users) ──
    socket.on('save-training-result', (data: {
        token: string; total: number; correct: number; bestStreak: number;
    }) => {
        const payload = verifyToken(data.token);
        if (!payload) return;
        recordTraining(payload.userId, data.total, data.correct, data.bestStreak);
    });

    // ── Sync chips to server (logged-in users) ──
    socket.on('sync-chips', (data: { token: string; chips: number }) => {
        const payload = verifyToken(data.token);
        if (!payload) return;
        updateChips(payload.userId, data.chips);
    });

    // ── Disconnect (grace period) ──
    socket.on('disconnect', () => {
        console.log(`[disconnect] ${socket.id}`);
        const found = findPlayerIdBySocket(socket.id);
        if (!found) return;

        const { playerId, room } = found;
        const player = room.players.get(playerId);
        if (!player) return;

        player.disconnected = true;
        io.to(room.code).emit('room-update', serializeRoom(room));
        console.log(`[grace] ${player.name} has ${DISCONNECT_GRACE_MS / 1000}s to reconnect`);

        // If it was their turn during player_turns, auto-stand after 5s
        if (room.phase === 'player_turns' && room.activePlayerId === playerId) {
            setTimeout(() => {
                const p = room.players.get(playerId);
                if (p && p.disconnected && room.activePlayerId === playerId) {
                    // Auto-stand all playing hands
                    for (const hand of p.hands) {
                        if (hand.status === 'playing') hand.status = 'standing';
                    }
                    p.isDone = true;
                    advanceToNextPlayer(room);
                    io.to(room.code).emit('room-update', serializeRoom(room));
                }
            }, 5000);
        }

        // Start grace period timer
        const timer = setTimeout(() => {
            disconnectTimers.delete(playerId);
            const currentRoom = rooms.get(room.code);
            if (!currentRoom) return;
            const currentPlayer = currentRoom.players.get(playerId);
            if (!currentPlayer || !currentPlayer.disconnected) return;

            console.log(`[timeout] Removing ${currentPlayer.name} after grace period`);
            removePlayer(playerId, currentRoom);
        }, DISCONNECT_GRACE_MS);

        disconnectTimers.set(playerId, timer);
    });
});

// ─── Game Logic ───────────────────────────────────────────────────────────────

function dealRound(room: Room) {
    room.phase = 'player_turns';

    // Deal 2 cards to each connected player
    const playerIds = Array.from(room.players.keys()).filter(
        pid => !room.players.get(pid)!.disconnected
    );
    for (const pid of playerIds) {
        const p = room.players.get(pid)!;
        const c1 = drawCard(room);
        const c2 = drawCard(room);
        p.hands = [{
            id: `hand-${pid}-${Date.now()}`,
            cards: [c1, c2],
            bet: p.currentBet,
            status: 'playing',
        }];

        // Check for player blackjack
        const { total } = calculateHandValue([c1, c2]);
        if (total === 21) {
            p.hands[0].status = 'blackjack';
            p.isDone = true;
        }
    }

    // Deal dealer cards
    room.dealerHand = [drawCard(room), drawCard(room)];

    // Check dealer blackjack
    const { total: dTotal } = calculateHandValue(room.dealerHand);
    if (dTotal === 21) {
        // Dealer blackjack — resolve immediately
        resolveAllResults(room);
        io.to(room.code).emit('room-update', serializeRoom(room));
        return;
    }

    // Set first non-done player as active
    const firstActive = playerIds.find(pid => !room.players.get(pid)!.isDone);
    if (firstActive) {
        room.activePlayerId = firstActive;
    } else {
        // All players have blackjack, go to dealer turn
        runDealerTurn(room);
    }

    io.to(room.code).emit('room-update', serializeRoom(room));
}

function handleHit(room: Room, player: RoomPlayer, hi: number) {
    const hand = player.hands[hi];
    const card = drawCard(room);
    hand.cards.push(card);
    const { total } = calculateHandValue(hand.cards);
    if (total > 21) {
        hand.status = 'busted';
        hand.result = 'loss';
    }
}

function handleStand(room: Room, player: RoomPlayer, hi: number) {
    player.hands[hi].status = 'standing';
}

function handleDouble(room: Room, player: RoomPlayer, hi: number) {
    const hand = player.hands[hi];
    if (hand.cards.length !== 2) return;
    const extraBet = hand.bet;
    if (player.chips < extraBet) return;

    player.chips -= extraBet;
    hand.bet *= 2;

    const card = drawCard(room);
    hand.cards.push(card);
    const { total } = calculateHandValue(hand.cards);
    if (total > 21) {
        hand.status = 'busted';
        hand.result = 'loss';
    } else {
        hand.status = 'standing';
    }
}

function handleSplit(room: Room, player: RoomPlayer, hi: number) {
    const hand = player.hands[hi];
    if (!isStrictPair(hand.cards)) return;
    if (player.hands.length >= 4) return;

    const extraBet = hand.bet;
    if (player.chips < extraBet) return;
    player.chips -= extraBet;

    const [c1, c2] = hand.cards;
    const hand1: PlayerHand = {
        id: `hand-${player.playerId}-${Date.now()}-1`,
        cards: [c1, drawCard(room)],
        bet: hand.bet,
        status: 'playing',
    };
    const hand2: PlayerHand = {
        id: `hand-${player.playerId}-${Date.now()}-2`,
        cards: [c2, drawCard(room)],
        bet: hand.bet,
        status: 'playing',
    };

    // Aces split → one card each, stand
    if (c1.rank === 'A') {
        hand1.status = 'standing';
        hand2.status = 'standing';
    }

    player.hands.splice(hi, 1, hand1, hand2);
}

function advanceToNextPlayer(room: Room) {
    const playerIds = Array.from(room.players.keys());
    const currentIdx = playerIds.indexOf(room.activePlayerId ?? '');
    for (let i = currentIdx + 1; i < playerIds.length; i++) {
        const p = room.players.get(playerIds[i])!;
        if (!p.isDone && !p.disconnected) {
            room.activePlayerId = playerIds[i];
            io.to(room.code).emit('room-update', serializeRoom(room));
            return;
        }
    }
    // All players done → dealer turn
    runDealerTurn(room);
}

async function runDealerTurn(room: Room) {
    room.phase = 'dealer_turn';
    room.activePlayerId = null;
    io.to(room.code).emit('room-update', serializeRoom(room));

    // Check if any live hands exist (non-busted, non-blackjack)
    let hasLiveHands = false;
    for (const p of room.players.values()) {
        for (const h of p.hands) {
            if (h.status !== 'busted' && h.status !== 'blackjack') {
                hasLiveHands = true;
                break;
            }
        }
    }

    if (hasLiveHands) {
        // Dealer draws
        let { total, isSoft } = calculateHandValue(room.dealerHand);
        while (total < 17 || (total === 17 && isSoft)) {
            await sleep(700);
            room.dealerHand.push(drawCard(room));
            ({ total, isSoft } = calculateHandValue(room.dealerHand));
            io.to(room.code).emit('room-update', serializeRoom(room));
        }
    }

    await sleep(500);
    resolveAllResults(room);
    io.to(room.code).emit('room-update', serializeRoom(room));
}

function resolveAllResults(room: Room) {
    room.phase = 'results';
    const { total: dTotal } = calculateHandValue(room.dealerHand);
    const dealerBust = dTotal > 21;
    const dealerBJ = room.dealerHand.length === 2 && dTotal === 21;

    for (const player of room.players.values()) {
        for (const hand of player.hands) {
            if (hand.result) continue; // already settled (bust)

            const { total: pTotal } = calculateHandValue(hand.cards);
            const playerBJ = hand.status === 'blackjack';

            if (dealerBJ && playerBJ) {
                hand.result = 'push';
                player.chips += hand.bet; // return bet
            } else if (dealerBJ) {
                hand.result = 'loss';
            } else if (playerBJ) {
                hand.result = 'win';
                player.chips += hand.bet + Math.floor(hand.bet * 1.5); // 3:2
            } else if (dealerBust) {
                hand.result = 'win';
                player.chips += hand.bet * 2;
            } else if (pTotal > dTotal) {
                hand.result = 'win';
                player.chips += hand.bet * 2;
            } else if (pTotal < dTotal) {
                hand.result = 'loss';
            } else {
                hand.result = 'push';
                player.chips += hand.bet;
            }
        }
    }
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '3001', 10);
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Multiplayer server running on http://0.0.0.0:${PORT}`);
});
