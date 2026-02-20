import React, { useState, useRef } from 'react';
import Card from './Card';
import { playSound } from '../utils/sound';
import { createDeck, shuffleDeck, calculateHandValue, isStrictPair } from '../utils/deck';
import { getCorrectAction } from '../utils/strategy';
import { Card as CardType, Action, PlayerHand, GameState } from '../types';

interface PlayingModeProps {
  onBack: () => void;
}

// ─── Helper: sync ref + state together ───────────────────────────────────────
// All mutable game state is stored in both a ref (for synchronous reads in
// handlers/async functions) AND React state (for re-renders).  We ONLY ever
// read from refs inside handlers; state is only used for rendering.

const PlayingMode: React.FC<PlayingModeProps> = ({ onBack }) => {
  // ── Deck ──────────────────────────────────────────────────────────────────
  const deckRef = useRef<CardType[]>(shuffleDeck(createDeck(6)));

  const drawCard = (): CardType => {
    if (deckRef.current.length < 20) {
      deckRef.current = shuffleDeck(createDeck(6));
    }
    return deckRef.current.pop()!;
  };

  // ── Live game state: refs (truth) + state (display) ──────────────────────
  const dealerHandRef = useRef<CardType[]>([]);
  const [dealerHand, setDealerHand] = useState<CardType[]>([]);

  const playerHandsRef = useRef<PlayerHand[]>([]);
  const [playerHands, setPlayerHands] = useState<PlayerHand[]>([]);

  const activeIdxRef = useRef<number>(0);
  const [activeHandIndex, setActiveHandIndex] = useState<number>(0);

  const gameStateRef = useRef<GameState>('idle');
  const [gameState, setGameState] = useState<GameState>('idle');

  const [message, setMessage] = useState<string>('');

  // ── Stats ─────────────────────────────────────────────────────────────────
  const [stats, setStats] = useState({
    totalDecisions: 0,
    correctDecisions: 0,
    currentStreak: 0,
    bestStreak: 0,
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const syncDealerHand = (hand: CardType[]) => {
    dealerHandRef.current = hand;
    setDealerHand(hand);
  };

  const syncPlayerHands = (hands: PlayerHand[]) => {
    playerHandsRef.current = hands;
    setPlayerHands(hands);
  };

  const syncActiveIdx = (idx: number) => {
    activeIdxRef.current = idx;
    setActiveHandIndex(idx);
  };

  const syncGameState = (gs: GameState) => {
    gameStateRef.current = gs;
    setGameState(gs);
  };

  const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

  // ── Deal ──────────────────────────────────────────────────────────────────
  const dealGame = () => {
    // All 4 cards drawn synchronously from deckRef — no stale state
    const p1 = drawCard();
    const d1 = drawCard();
    const p2 = drawCard();
    const d2 = drawCard();

    const initialHand: PlayerHand = {
      id: `hand-${Date.now()}`,
      cards: [p1, p2],
      bet: 1,
      status: 'playing',
    };

    syncDealerHand([d1, d2]);
    syncPlayerHands([initialHand]);
    syncActiveIdx(0);
    setMessage('');
    playSound('deal');

    const { total: pTotal } = calculateHandValue([p1, p2]);
    const { total: dTotal } = calculateHandValue([d1, d2]);

    if (pTotal === 21 && dTotal === 21) {
      const h = { ...initialHand, status: 'blackjack' as const, result: 'push' as const };
      syncPlayerHands([h]);
      syncGameState('game_over');
      setMessage('🤝 Double Blackjack! Push!');
      playSound('push');
    } else if (dTotal === 21) {
      const h = { ...initialHand, result: 'loss' as const };
      syncPlayerHands([h]);
      syncGameState('game_over');
      setMessage('🤡 Dealer Blackjack! You Lose.');
      playSound('loss');
    } else if (pTotal === 21) {
      const h = { ...initialHand, status: 'blackjack' as const, result: 'win' as const };
      syncPlayerHands([h]);
      syncGameState('game_over');
      setMessage('🚀 BLACKJACK! You Win! 🌕');
      playSound('blackjack');
    } else {
      syncGameState('player_turn');
    }
  };

  // ── Dealer turn (async, always reads from refs) ───────────────────────────
  const runDealerTurn = async () => {
    syncGameState('dealer_turn');

    // Read live hands from ref
    const hands = playerHandsRef.current;
    const liveHands = hands.filter(
      h => h.status !== 'busted' && h.status !== 'blackjack' && h.status !== 'playing' // 'playing' means no action taken yet — shouldn't happen
    );

    // If every player hand is already busted → dealer doesn't play
    if (liveHands.length === 0) {
      await wait(400);
      syncGameState('game_over');
      resolveResults();
      return;
    }

    await wait(600);

    // Reveal hole card, then draw until dealer stands (≥17, not soft 17)
    // dealerHandRef already has both cards
    let { total, isSoft } = calculateHandValue(dealerHandRef.current);

    while (total < 17 || (total === 17 && isSoft)) {
      await wait(700);
      const card = drawCard();
      const newDHand = [...dealerHandRef.current, card];
      syncDealerHand(newDHand);
      ({ total, isSoft } = calculateHandValue(newDHand));
    }

    await wait(500);
    syncGameState('game_over');
    resolveResults();
  };

  // ── Resolve results (reads from refs — always current) ────────────────────
  const resolveResults = () => {
    const finalDealerHand = dealerHandRef.current;
    const { total: dTotal } = calculateHandValue(finalDealerHand);
    const dealerBust = dTotal > 21;

    const newHands = playerHandsRef.current.map(hand => {
      if (hand.result) return hand; // already settled (bust / blackjack at deal)

      const { total: pTotal } = calculateHandValue(hand.cards);

      if (dealerBust) return { ...hand, result: 'win' as const };
      if (pTotal > dTotal) return { ...hand, result: 'win' as const };
      if (pTotal < dTotal) return { ...hand, result: 'loss' as const };
      return { ...hand, result: 'push' as const };
    });

    syncPlayerHands(newHands);

    const wins = newHands.filter(h => h.result === 'win').length;
    const losses = newHands.filter(h => h.result === 'loss').length;

    if (wins > losses) {
      playSound('win');
      setMessage(dealerBust ? '💥 Dealer Busted! You Win! 🎉' : '🎉 You Win! 💰');
    } else if (losses > wins) {
      playSound('loss');
      setMessage('💸 Dealer Wins.');
    } else {
      playSound('push');
      setMessage('🤝 Push!');
    }
  };

  // ── Move to next hand or dealer ───────────────────────────────────────────
  const advanceHand = () => {
    const idx = activeIdxRef.current;
    const hands = playerHandsRef.current;

    if (idx < hands.length - 1) {
      syncActiveIdx(idx + 1);
    } else {
      runDealerTurn();
    }
  };

  // ── Track strategy decision ───────────────────────────────────────────────
  const trackDecision = (action: Action) => {
    const hand = playerHandsRef.current[activeIdxRef.current];
    const dealerUp = dealerHandRef.current[0];
    if (!hand || !dealerUp) return;

    const { action: correctAction } = getCorrectAction(hand.cards, dealerUp);
    const isCorrect = action === correctAction;

    setStats(prev => {
      const newStreak = isCorrect ? prev.currentStreak + 1 : 0;
      return {
        totalDecisions: prev.totalDecisions + 1,
        correctDecisions: prev.correctDecisions + (isCorrect ? 1 : 0),
        currentStreak: newStreak,
        bestStreak: Math.max(prev.bestStreak, newStreak),
      };
    });
  };

  // ── Player actions ────────────────────────────────────────────────────────

  const handleHit = () => {
    if (gameStateRef.current !== 'player_turn') return;
    trackDecision(Action.Hit);

    const idx = activeIdxRef.current;
    // *** Always read from ref — never from render closure ***
    const hand = playerHandsRef.current[idx];
    if (!hand) return;

    const newCard = drawCard();
    const updatedCards = [...hand.cards, newCard];
    const { total } = calculateHandValue(updatedCards);

    const updatedHand: PlayerHand = {
      ...hand,
      cards: updatedCards,
      status: total > 21 ? 'busted' : 'playing',
      result: total > 21 ? 'loss' : undefined,
    };

    // Build new hands array and flush to both ref and state immediately
    const newHands = playerHandsRef.current.map((h, i) => (i === idx ? updatedHand : h));
    syncPlayerHands(newHands);

    if (total > 21) {
      playSound('bust');
      // Advance after a short pause so player sees the bust card
      setTimeout(advanceHand, 600);
    }
    // If not bust: stay on same hand, player can Hit/Stand/Double again
  };

  const handleStand = () => {
    if (gameStateRef.current !== 'player_turn') return;
    trackDecision(Action.Stand);

    const idx = activeIdxRef.current;
    const hand = playerHandsRef.current[idx];
    if (!hand) return;

    const updatedHand = { ...hand, status: 'standing' as const };
    const newHands = playerHandsRef.current.map((h, i) => (i === idx ? updatedHand : h));
    syncPlayerHands(newHands);

    advanceHand();
  };

  const handleDouble = () => {
    if (gameStateRef.current !== 'player_turn') return;
    const idx = activeIdxRef.current;
    const hand = playerHandsRef.current[idx];
    if (!hand || hand.cards.length !== 2) return;

    trackDecision(Action.Double);

    const newCard = drawCard();
    const updatedCards = [...hand.cards, newCard];
    const { total } = calculateHandValue(updatedCards);
    const bust = total > 21;

    const updatedHand: PlayerHand = {
      ...hand,
      cards: updatedCards,
      status: bust ? 'busted' : 'standing',
      result: bust ? 'loss' : undefined,
    };

    const newHands = playerHandsRef.current.map((h, i) => (i === idx ? updatedHand : h));
    syncPlayerHands(newHands);

    if (bust) playSound('bust');
    // Auto-move after seeing the double card
    setTimeout(advanceHand, 600);
  };

  const handleSplit = () => {
    if (gameStateRef.current !== 'player_turn') return;
    const idx = activeIdxRef.current;
    const hand = playerHandsRef.current[idx];
    if (!hand || !isStrictPair(hand.cards)) return;
    if (playerHandsRef.current.length >= 4) return; // max 4 hands

    trackDecision(Action.Split);

    const [card1, card2] = hand.cards;
    const hand1: PlayerHand = {
      ...hand,
      id: `hand-${Date.now()}-1`,
      cards: [card1, drawCard()],
      status: 'playing',
      result: undefined,
    };
    const hand2: PlayerHand = {
      ...hand,
      id: `hand-${Date.now()}-2`,
      cards: [card2, drawCard()],
      status: 'playing',
      result: undefined,
    };

    const newHands = [...playerHandsRef.current];
    newHands.splice(idx, 1, hand1, hand2);

    // Aces rule: only one card each, auto-stand both
    if (card1.rank === 'A') {
      newHands[idx].status = 'standing';
      newHands[idx + 1].status = 'standing';
      syncPlayerHands(newHands);
      runDealerTurn();
    } else {
      syncPlayerHands(newHands);
    }
  };

  // ── Derived display values ─────────────────────────────────────────────────
  const activeHand = playerHands[activeHandIndex];
  const { total: playerTotal, isSoft: playerSoft } = activeHand
    ? calculateHandValue(activeHand.cards)
    : { total: 0, isSoft: false };

  const canSplit =
    gameState === 'player_turn' &&
    activeHand != null &&
    isStrictPair(activeHand.cards) &&
    playerHands.length < 4;

  const canDouble =
    gameState === 'player_turn' &&
    activeHand != null &&
    activeHand.cards.length === 2;

  const accuracy =
    stats.totalDecisions === 0
      ? '—'
      : `${Math.round((stats.correctDecisions / stats.totalDecisions) * 100)}%`;

  // Dealer upcard value shown during player turn (only first card visible)
  const dealerUpTotal =
    dealerHand.length > 0 ? calculateHandValue([dealerHand[0]]).total : 0;

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <header className="w-full bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center z-10 shadow-md">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-blue-400 tracking-wider hidden sm:block">
            PLAYING <span className="text-white font-normal">MODE</span>
          </h1>
        </div>

        <div className="flex gap-6 text-sm sm:text-base font-mono">
          <div className="flex flex-col items-end">
            <span className="text-slate-400 text-xs uppercase">Strategy</span>
            <span
              className={
                stats.totalDecisions > 0 && stats.correctDecisions / stats.totalDecisions >= 0.9
                  ? 'text-emerald-400'
                  : 'text-white'
              }
            >
              {accuracy}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-slate-400 text-xs uppercase">Streak</span>
            <span className="text-yellow-400">⚡ {stats.currentStreak}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-slate-400 text-xs uppercase">Best</span>
            <span className="text-blue-400">🏆 {stats.bestStreak}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto flex flex-col items-center p-4 relative overflow-hidden">
        {/* Dealer Area */}
        <div className="flex flex-col items-center mb-8 mt-4 min-h-[180px]">
          <div className="text-slate-400 text-xs uppercase tracking-widest mb-2">Dealer</div>
          <div className="flex gap-3 flex-wrap justify-center">
            {dealerHand.map((card, i) => (
              <Card
                key={card.id}
                card={card}
                faceDown={i === 1 && gameState === 'player_turn'}
              />
            ))}
          </div>
          {/* Dealer score: during player_turn show only upcard value */}
          {dealerHand.length > 0 && (
            <div className="mt-2 text-slate-300 font-mono text-sm">
              {gameState === 'player_turn'
                ? `Showing: ${dealerUpTotal}`
                : `Total: ${calculateHandValue(dealerHand).total}${calculateHandValue(dealerHand).isSoft ? ' (Soft)' : ''}`
              }
            </div>
          )}
        </div>

        {/* Player Hands Area */}
        <div className="flex-1 flex items-center justify-center w-full gap-6 sm:gap-10 flex-wrap">
          {gameState === 'idle' ? (
            <div className="text-slate-500 text-lg">Press Deal to start</div>
          ) : (
            playerHands.map((hand, index) => {
              const isActive = index === activeHandIndex && gameState === 'player_turn';
              const { total, isSoft } = calculateHandValue(hand.cards);
              const bust = hand.status === 'busted';

              return (
                <div
                  key={hand.id}
                  className={`flex flex-col items-center transition-all duration-300
                    ${isActive ? 'opacity-100 scale-105' : 'opacity-60'}
                    ${hand.result === 'win' ? 'text-emerald-400' : ''}
                    ${hand.result === 'loss' ? 'text-red-400' : ''}
                  `}
                >
                  <div className="mb-2 font-mono text-sm font-bold flex gap-2 items-center">
                    <span>
                      {total}
                      {bust ? ' BUST' : isSoft ? ' (Soft)' : ''}
                    </span>
                    {hand.result && (
                      <span
                        className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${hand.result === 'win'
                            ? 'bg-emerald-600/40 text-emerald-300'
                            : hand.result === 'loss'
                              ? 'bg-red-600/40 text-red-300'
                              : 'bg-slate-600/40 text-slate-300'
                          }`}
                      >
                        {hand.result}
                      </span>
                    )}
                  </div>
                  {/* Cards stacked with overlap */}
                  <div className="flex relative" style={{ paddingRight: `${(hand.cards.length - 1) * 0}px` }}>
                    {hand.cards.map((card, i) => (
                      <div
                        key={card.id}
                        style={{ marginLeft: i > 0 ? '-48px' : '0', zIndex: i }}
                        className="relative"
                      >
                        <Card card={card} />
                      </div>
                    ))}
                  </div>
                  {isActive && (
                    <div className="mt-3 w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Message Overlay */}
        {message && gameState === 'game_over' && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/85 px-8 py-5 rounded-2xl backdrop-blur-md border border-white/10 shadow-2xl z-20 whitespace-nowrap">
            <h2 className="text-2xl font-bold text-white text-center">{message}</h2>
          </div>
        )}

        {/* Controls */}
        <div className="w-full mt-auto py-6">
          {gameState === 'idle' || gameState === 'game_over' ? (
            <div className="flex justify-center">
              <button
                onClick={() => {
                  playSound('click');
                  dealGame();
                }}
                className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold py-4 px-14 rounded-xl text-xl shadow-lg transition-all"
              >
                {gameState === 'idle' ? 'Deal Cards' : 'Play Again'}
              </button>
            </div>
          ) : gameState === 'player_turn' ? (
            <div className="flex flex-wrap gap-3 sm:gap-4 justify-center w-full max-w-2xl px-4 mx-auto">
              <button
                onClick={() => { playSound('click'); handleHit(); }}
                className="action-btn bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-4 px-6 rounded-xl min-w-[100px] shadow-md uppercase tracking-wider transition-all"
              >
                Hit
              </button>
              <button
                onClick={() => { playSound('click'); handleStand(); }}
                className="action-btn bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold py-4 px-6 rounded-xl min-w-[100px] shadow-md uppercase tracking-wider transition-all"
              >
                Stand
              </button>
              <button
                onClick={() => { playSound('click'); handleDouble(); }}
                disabled={!canDouble}
                className="action-btn bg-yellow-600 hover:bg-yellow-500 active:scale-95 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl min-w-[100px] shadow-md uppercase tracking-wider transition-all"
              >
                Double
              </button>
              <button
                onClick={() => { playSound('click'); handleSplit(); }}
                disabled={!canSplit}
                className="action-btn bg-purple-600 hover:bg-purple-500 active:scale-95 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl min-w-[100px] shadow-md uppercase tracking-wider transition-all"
              >
                Split
              </button>
            </div>
          ) : (
            // dealer_turn — show waiting indicator
            <div className="flex justify-center">
              <div className="text-slate-400 text-sm animate-pulse tracking-widest uppercase">
                Dealer playing…
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default PlayingMode;