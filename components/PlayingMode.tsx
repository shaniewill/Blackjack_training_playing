import React, { useState, useRef } from 'react';
import Card from './Card';
import { playSound } from '../utils/sound';
import { createDeck, shuffleDeck, calculateHandValue, isStrictPair } from '../utils/deck';
import { Card as CardType, PlayerHand, GameState } from '../types';

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

  // ── Chips & Betting ───────────────────────────────────────────────────────
  const STARTING_CHIPS = 1000;
  const CHIP_VALUES = [10, 25, 100, 500] as const;
  const chipsRef = useRef<number>(STARTING_CHIPS);
  const [chips, setChips] = useState<number>(STARTING_CHIPS);
  const currentBetRef = useRef<number>(0);
  const [currentBet, setCurrentBet] = useState<number>(0);

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

  const syncChips = (val: number) => {
    chipsRef.current = val;
    setChips(val);
  };

  const syncCurrentBet = (val: number) => {
    currentBetRef.current = val;
    setCurrentBet(val);
  };

  const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

  // ── Betting ────────────────────────────────────────────────────────────────
  const startBetting = () => {
    syncDealerHand([]);
    syncPlayerHands([]);
    syncCurrentBet(0);
    syncGameState('betting');
    setMessage('');
  };

  const addChipToBet = (value: number) => {
    if (currentBetRef.current + value > chipsRef.current) return;
    syncCurrentBet(currentBetRef.current + value);
  };

  const removeLastChip = () => {
    // Remove the last chip added — since we don't track individual chips,
    // just clear the whole bet for simplicity
    syncCurrentBet(0);
  };

  const confirmBet = () => {
    if (currentBetRef.current <= 0) return;
    // Deduct bet from balance
    syncChips(chipsRef.current - currentBetRef.current);
    dealGame();
  };

  // ── Deal ──────────────────────────────────────────────────────────────────
  const dealGame = () => {
    const betAmount = currentBetRef.current;

    const p1 = drawCard();
    const d1 = drawCard();
    const p2 = drawCard();
    const d2 = drawCard();

    const initialHand: PlayerHand = {
      id: `hand-${Date.now()}`,
      cards: [p1, p2],
      bet: betAmount,
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
      // Push: return bet
      syncChips(chipsRef.current + betAmount);
      playSound('push');
    } else if (dTotal === 21) {
      const h = { ...initialHand, result: 'loss' as const };
      syncPlayerHands([h]);
      syncGameState('game_over');
      setMessage('🤡 Dealer Blackjack! You Lose.');
      // Loss: bet already deducted
      playSound('loss');
    } else if (pTotal === 21) {
      const h = { ...initialHand, status: 'blackjack' as const, result: 'win' as const };
      syncPlayerHands([h]);
      syncGameState('game_over');
      setMessage('🚀 BLACKJACK! You Win! 🌕');
      // Blackjack pays 3:2 — return bet + 1.5x
      syncChips(chipsRef.current + betAmount + Math.floor(betAmount * 1.5));
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

    // ── Calculate chip payouts ──
    let totalPayout = 0;
    for (const hand of newHands) {
      if (hand.result === 'win') {
        // Win: return bet + winnings (1:1)
        totalPayout += hand.bet * 2;
      } else if (hand.result === 'push') {
        // Push: return bet
        totalPayout += hand.bet;
      }
      // Loss: nothing returned
    }
    if (totalPayout > 0) {
      syncChips(chipsRef.current + totalPayout);
    }

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



  // ── Player actions ────────────────────────────────────────────────────────

  const handleHit = () => {
    if (gameStateRef.current !== 'player_turn') return;

    const idx = activeIdxRef.current;
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

    const newHands = playerHandsRef.current.map((h, i) => (i === idx ? updatedHand : h));
    syncPlayerHands(newHands);

    if (total > 21) {
      playSound('bust');
      setTimeout(advanceHand, 600);
    }
  };

  const handleStand = () => {
    if (gameStateRef.current !== 'player_turn') return;

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

    // Double: deduct extra bet from chips
    const extraBet = hand.bet;
    if (chipsRef.current < extraBet) return; // can't afford to double
    syncChips(chipsRef.current - extraBet);

    const newCard = drawCard();
    const updatedCards = [...hand.cards, newCard];
    const { total } = calculateHandValue(updatedCards);
    const bust = total > 21;

    const updatedHand: PlayerHand = {
      ...hand,
      cards: updatedCards,
      bet: hand.bet * 2, // doubled bet
      status: bust ? 'busted' : 'standing',
      result: bust ? 'loss' : undefined,
    };

    const newHands = playerHandsRef.current.map((h, i) => (i === idx ? updatedHand : h));
    syncPlayerHands(newHands);

    if (bust) playSound('bust');
    setTimeout(advanceHand, 600);
  };

  const handleSplit = () => {
    if (gameStateRef.current !== 'player_turn') return;
    const idx = activeIdxRef.current;
    const hand = playerHandsRef.current[idx];
    if (!hand || !isStrictPair(hand.cards)) return;
    if (playerHandsRef.current.length >= 4) return; // max 4 hands

    // Split: deduct extra bet for the second hand
    const extraBet = hand.bet;
    if (chipsRef.current < extraBet) return; // can't afford to split
    syncChips(chipsRef.current - extraBet);

    const [card1, card2] = hand.cards;
    const hand1: PlayerHand = {
      ...hand,
      id: `hand-${Date.now()}-1`,
      cards: [card1, drawCard()],
      bet: hand.bet, // same bet per hand
      status: 'playing',
      result: undefined,
    };
    const hand2: PlayerHand = {
      ...hand,
      id: `hand-${Date.now()}-2`,
      cards: [card2, drawCard()],
      bet: hand.bet, // same bet per hand
      status: 'playing',
      result: undefined,
    };

    const newHands = [...playerHandsRef.current];
    newHands.splice(idx, 1, hand1, hand2);

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
    playerHands.length < 4 &&
    chips >= (activeHand?.bet ?? 0);

  const canDouble =
    gameState === 'player_turn' &&
    activeHand != null &&
    activeHand.cards.length === 2 &&
    chips >= (activeHand?.bet ?? 0);

  // Dealer upcard value shown during player turn (only first card visible)
  const dealerUpTotal =
    dealerHand.length > 0 ? calculateHandValue([dealerHand[0]]).total : 0;

  const isBroke = chips <= 0 && gameState !== 'player_turn' && gameState !== 'dealer_turn';

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

        {/* Chip Balance */}
        <div className="flex gap-4 items-center">
          <div className="flex flex-col items-end">
            <span className="text-slate-400 text-xs uppercase tracking-wider">Balance</span>
            <span className={`text-lg font-bold font-mono ${chips >= STARTING_CHIPS ? 'text-emerald-400' : chips > 200 ? 'text-yellow-400' : 'text-red-400'
              }`}>
              💰 {chips.toLocaleString()}
            </span>
          </div>
          {(gameState === 'player_turn' || gameState === 'dealer_turn' || gameState === 'game_over') && (
            <div className="flex flex-col items-end">
              <span className="text-slate-400 text-xs uppercase tracking-wider">Bet</span>
              <span className="text-lg font-bold font-mono text-amber-300">
                � {currentBet.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto flex flex-col items-center p-4 relative overflow-hidden">
        {/* Dealer Area */}
        <div className="flex flex-col items-center mb-4 mt-2 shrink-0">
          <div className="text-slate-400 text-xs uppercase tracking-widest mb-2">Dealer</div>
          <div className="flex gap-2 flex-wrap justify-center">
            {dealerHand.map((card, i) => (
              <Card
                key={card.id}
                card={card}
                faceDown={i === 1 && gameState === 'player_turn'}
              />
            ))}
          </div>
          {dealerHand.length > 0 && (
            <div className="mt-2 text-slate-300 font-mono text-sm">
              {gameState === 'player_turn'
                ? `Showing: ${dealerUpTotal}`
                : `Total: ${calculateHandValue(dealerHand).total}${calculateHandValue(dealerHand).isSoft ? ' (Soft)' : ''}`
              }
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-32 border-t border-slate-700 mb-4" />

        {/* Player Hands Area */}
        <div className="flex-1 flex items-start justify-center w-full gap-6 sm:gap-10 flex-wrap pt-2">
          {gameState === 'idle' ? (
            <div className="text-slate-500 text-lg">Place your bet to start</div>
          ) : gameState === 'betting' ? (
            /* ── Betting UI ── */
            <div className="flex flex-col items-center gap-6">
              <div className="text-slate-300 text-lg font-semibold tracking-wide">Place Your Bet</div>

              {/* Current bet display */}
              <div className="bg-slate-800/80 border border-slate-600 rounded-2xl px-10 py-5 text-center">
                <div className="text-slate-400 text-xs uppercase tracking-widest mb-1">Current Bet</div>
                <div className="text-4xl font-bold font-mono text-amber-300">
                  {currentBet.toLocaleString()}
                </div>
              </div>

              {/* Chip buttons */}
              <div className="flex gap-3 flex-wrap justify-center">
                {CHIP_VALUES.map(val => (
                  <button
                    key={val}
                    onClick={() => { playSound('click'); addChipToBet(val); }}
                    disabled={currentBet + val > chips}
                    className={`relative w-16 h-16 rounded-full font-bold text-sm shadow-lg
                      transition-all active:scale-90
                      ${currentBet + val > chips
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

              {/* Clear / Deal buttons */}
              <div className="flex gap-4">
                <button
                  onClick={() => { playSound('click'); removeLastChip(); }}
                  disabled={currentBet === 0}
                  className="bg-slate-600 hover:bg-slate-500 disabled:bg-slate-800 disabled:text-slate-600 active:scale-95 text-white font-bold py-3 px-8 rounded-xl transition-all"
                >
                  Clear
                </button>
                <button
                  onClick={() => { playSound('click'); confirmBet(); }}
                  disabled={currentBet === 0}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 active:scale-95 text-white font-bold py-3 px-10 rounded-xl text-lg transition-all"
                >
                  Deal 🃏
                </button>
              </div>
            </div>
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
                  {/* Cards */}
                  <div className="flex relative">
                    {hand.cards.map((card, i) => (
                      <div
                        key={card.id}
                        style={{ marginLeft: i > 0 ? '-30px' : '0', zIndex: i }}
                        className="relative"
                      >
                        <Card card={card} />
                      </div>
                    ))}
                  </div>
                  {/* Hand info below cards */}
                  <div className="mt-2 font-mono text-sm font-bold flex gap-2 items-center">
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
                          } `}
                      >
                        {hand.result}
                      </span>
                    )}
                    <span className="text-xs text-amber-300/70">({hand.bet})</span>
                  </div>
                  {isActive && (
                    <div className="mt-2 w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
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
          {gameState === 'idle' ? (
            <div className="flex justify-center">
              <button
                onClick={() => { playSound('click'); startBetting(); }}
                className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold py-4 px-14 rounded-xl text-xl shadow-lg transition-all"
              >
                Start Playing
              </button>
            </div>
          ) : gameState === 'game_over' ? (
            <div className="flex flex-col items-center gap-3">
              {isBroke ? (
                <>
                  <div className="text-red-400 font-bold text-lg">💸 You're out of chips!</div>
                  <button
                    onClick={() => {
                      playSound('click');
                      syncChips(STARTING_CHIPS);
                      syncGameState('idle');
                      setMessage('');
                    }}
                    className="bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold py-3 px-10 rounded-xl text-lg shadow-lg transition-all"
                  >
                    Rebuy ({STARTING_CHIPS} chips)
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { playSound('click'); startBetting(); }}
                  className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold py-4 px-14 rounded-xl text-xl shadow-lg transition-all"
                >
                  Play Again
                </button>
              )}
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
          ) : gameState === 'betting' ? null : (
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