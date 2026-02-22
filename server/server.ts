import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';

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
    socketId: string;
    name: string;
    chips: number;
    hands: PlayerHand[];
    currentBet: number;
    hasBet: boolean;
    isDone: boolean; // all hands resolved for this round
}

type RoomPhase = 'lobby' | 'betting' | 'player_turns' | 'dealer_turn' | 'results';

interface Room {
    code: string;
    hostId: string;
    phase: RoomPhase;
    players: Map<string, RoomPlayer>;
    deck: Card[];
    dealerHand: Card[];
    activePlayerId: string | null; // whose turn it is
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

function generateCode(): string {
    let code: string;
    do {
        code = String(Math.floor(1000 + Math.random() * 9000));
    } while (rooms.has(code));
    return code;
}

function serializeRoom(room: Room) {
    const players = Array.from(room.players.entries()).map(([sid, p]) => ({
        socketId: sid,
        name: p.name,
        chips: p.chips,
        hands: p.hands,
        currentBet: p.currentBet,
        hasBet: p.hasBet,
        isDone: p.isDone,
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

// ─── Server setup ─────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.get('/health', (_req, res) => { res.json({ ok: true }); });

// ─── Socket handlers ──────────────────────────────────────────────────────────
io.on('connection', (socket: Socket) => {
    console.log(`[connect] ${socket.id}`);

    // ── Create Room ──
    socket.on('create-room', ({ name }: { name: string }) => {
        const code = generateCode();
        const room: Room = {
            code,
            hostId: socket.id,
            phase: 'lobby',
            players: new Map(),
            deck: shuffleDeck(createDeck(6)),
            dealerHand: [],
            activePlayerId: null,
        };
        room.players.set(socket.id, {
            socketId: socket.id,
            name,
            chips: STARTING_CHIPS,
            hands: [],
            currentBet: 0,
            hasBet: false,
            isDone: false,
        });
        rooms.set(code, room);
        socket.join(code);
        socket.emit('room-created', { code });
        io.to(code).emit('room-update', serializeRoom(room));
    });

    // ── Join Room ──
    socket.on('join-room', ({ code, name }: { code: string; name: string }) => {
        const room = rooms.get(code);
        if (!room) { socket.emit('error-msg', 'Room not found'); return; }
        if (room.phase !== 'lobby') { socket.emit('error-msg', 'Game already in progress'); return; }
        if (room.players.size >= 6) { socket.emit('error-msg', 'Room is full (max 6)'); return; }

        room.players.set(socket.id, {
            socketId: socket.id,
            name,
            chips: STARTING_CHIPS,
            hands: [],
            currentBet: 0,
            hasBet: false,
            isDone: false,
        });
        socket.join(code);
        socket.emit('room-joined', { code });
        io.to(code).emit('room-update', serializeRoom(room));
    });

    // ── Start Game (host only) ──
    socket.on('start-game', ({ code }: { code: string }) => {
        const room = rooms.get(code);
        if (!room || room.hostId !== socket.id) return;
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
        const player = room.players.get(socket.id);
        if (!player || player.hasBet) return;
        if (amount <= 0 || amount > player.chips) return;

        player.currentBet = amount;
        player.chips -= amount;
        player.hasBet = true;

        io.to(code).emit('room-update', serializeRoom(room));

        // Check if all players have bet
        const allBet = Array.from(room.players.values()).every(p => p.hasBet);
        if (allBet) {
            dealRound(room);
        }
    });

    // ── Player Action ──
    socket.on('player-action', ({ code, action, handIndex }: { code: string; action: string; handIndex?: number }) => {
        const room = rooms.get(code);
        if (!room || room.phase !== 'player_turns') return;
        if (room.activePlayerId !== socket.id) return;
        const player = room.players.get(socket.id);
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
        if (!room || room.hostId !== socket.id) return;

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

    // ── Disconnect ──
    socket.on('disconnect', () => {
        console.log(`[disconnect] ${socket.id}`);
        for (const [code, room] of rooms) {
            if (room.players.has(socket.id)) {
                room.players.delete(socket.id);
                if (room.players.size === 0) {
                    rooms.delete(code);
                } else {
                    // Transfer host if needed
                    if (room.hostId === socket.id) {
                        room.hostId = room.players.keys().next().value!;
                    }
                    io.to(code).emit('room-update', serializeRoom(room));

                    // If in player_turns and this was the active player, advance
                    if (room.phase === 'player_turns' && room.activePlayerId === socket.id) {
                        advanceToNextPlayer(room);
                        io.to(code).emit('room-update', serializeRoom(room));
                    }
                }
            }
        }
    });
});

// ─── Game Logic ───────────────────────────────────────────────────────────────

function dealRound(room: Room) {
    room.phase = 'player_turns';

    // Deal 2 cards to each player
    const playerIds = Array.from(room.players.keys());
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
        id: `hand-${player.socketId}-${Date.now()}-1`,
        cards: [c1, drawCard(room)],
        bet: hand.bet,
        status: 'playing',
    };
    const hand2: PlayerHand = {
        id: `hand-${player.socketId}-${Date.now()}-2`,
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
        if (!p.isDone) {
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
httpServer.listen(PORT, () => {
    console.log(`Multiplayer server running on http://localhost:${PORT}`);
});
