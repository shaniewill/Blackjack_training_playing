import React, { useState, useEffect, useCallback, useRef } from 'react';
import Card from './Card';
import { playSound } from '../utils/sound';
import { createDeck, shuffleDeck, calculateHandValue, isStrictPair } from '../utils/deck';
import { getCorrectAction } from '../utils/strategy';
import { Card as CardType, Action, PlayerHand, GameState } from '../types';

interface PlayingModeProps {
  onBack: () => void;
}

const PlayingMode: React.FC<PlayingModeProps> = ({ onBack }) => {
  const [deck, setDeck] = useState<CardType[]>([]);
  const [dealerHand, setDealerHand] = useState<CardType[]>([]);
  const [playerHands, setPlayerHands] = useState<PlayerHand[]>([]);
  const [activeHandIndex, setActiveHandIndex] = useState<number>(0);
  const [gameState, setGameState] = useState<GameState>('idle');
  const [message, setMessage] = useState<string>('');

  // Stats State
  const [stats, setStats] = useState({
    totalDecisions: 0,
    correctDecisions: 0,
    currentStreak: 0,
    bestStreak: 0
  });

  // Initial Deck Setup
  useEffect(() => {
    setDeck(shuffleDeck(createDeck(6)));
  }, []);

  const dealGame = () => {
    let currentDeck = [...deck];
    if (currentDeck.length < 20) {
      currentDeck = shuffleDeck(createDeck(6));
    }

    // Deal: P, D, P, D(Hidden)
    const p1 = currentDeck.pop()!;
    const d1 = currentDeck.pop()!;
    const p2 = currentDeck.pop()!;
    const d2 = currentDeck.pop()!;

    const initialHand: PlayerHand = {
      id: 'hand-1',
      cards: [p1, p2],
      bet: 1,
      status: 'playing'
    };

    setDeck(currentDeck);
    setPlayerHands([initialHand]);
    setDealerHand([d1, d2]);
    setActiveHandIndex(0);
    setGameState('player_turn');
    setMessage('');
    playSound('deal');

    // Check Blackjacks
    const { total: pTotal } = calculateHandValue([p1, p2]);
    const { total: dTotal } = calculateHandValue([d1, d2]);

    if (pTotal === 21 && dTotal === 21) {
      // Push
      initialHand.status = 'blackjack';
      initialHand.result = 'push';
      setPlayerHands([initialHand]);
      setGameState('game_over');
      setMessage('Both have Blackjack! Push.');
    } else if (dTotal === 21) {
      // Dealer Wins
      initialHand.status = 'playing'; // Played but lost
      initialHand.result = 'loss';
      setPlayerHands([initialHand]);
      setGameState('game_over');
      setMessage('Dealer has Blackjack.');
    } else if (pTotal === 21) {
      // Player Wins
      initialHand.status = 'blackjack';
      initialHand.result = 'win';
      setPlayerHands([initialHand]);
      setGameState('game_over');
      setMessage('Blackjack! You win!');
    }
  };

  const drawCard = (): CardType => {
    const newDeck = [...deck];
    const card = newDeck.pop()!;
    setDeck(newDeck);
    return card;
  };

  const nextHandOrDealer = () => {
    if (activeHandIndex < playerHands.length - 1) {
      setActiveHandIndex(prev => prev + 1);
    } else {
      startDealerTurn();
    }
  };

  // Tracking Helper
  const trackDecision = (action: Action) => {
    const currentHand = playerHands[activeHandIndex];
    if (!currentHand) return;

    const dealerUp = dealerHand[0];
    const { action: correctAction } = getCorrectAction(currentHand.cards, dealerUp);

    const isCorrect = action === correctAction;

    setStats(prev => {
      const newStreak = isCorrect ? prev.currentStreak + 1 : 0;
      return {
        totalDecisions: prev.totalDecisions + 1,
        correctDecisions: prev.correctDecisions + (isCorrect ? 1 : 0),
        currentStreak: newStreak,
        bestStreak: Math.max(prev.bestStreak, newStreak)
      };
    });
  };

  const handleHit = () => {
    trackDecision(Action.Hit);

    const newHand = { ...playerHands[activeHandIndex] };
    newHand.cards = [...newHand.cards, drawCard()];

    const { total } = calculateHandValue(newHand.cards);
    if (total > 21) {
      newHand.status = 'busted';
      newHand.result = 'loss';
      playSound('bust');

      const newHands = [...playerHands];
      newHands[activeHandIndex] = newHand;
      setPlayerHands(newHands);

      setTimeout(nextHandOrDealer, 500);
    } else {
      const newHands = [...playerHands];
      newHands[activeHandIndex] = newHand;
      setPlayerHands(newHands);
      // Stay on this hand
    }
  };

  const handleStand = () => {
    trackDecision(Action.Stand);

    const newHand = { ...playerHands[activeHandIndex] };
    newHand.status = 'standing';

    const newHands = [...playerHands];
    newHands[activeHandIndex] = newHand;
    setPlayerHands(newHands);

    nextHandOrDealer();
  };

  const handleDouble = () => {
    trackDecision(Action.Double);

    const newHand = { ...playerHands[activeHandIndex] };
    newHand.cards = [...newHand.cards, drawCard()];
    newHand.status = 'doubled';

    // Check bust on double
    const { total } = calculateHandValue(newHand.cards);
    if (total > 21) {
      newHand.status = 'busted';
      newHand.result = 'loss';
      playSound('bust');
    } else {
      newHand.status = 'standing'; // Auto stand after double
    }

    const newHands = [...playerHands];
    newHands[activeHandIndex] = newHand;
    setPlayerHands(newHands);

    setTimeout(nextHandOrDealer, 500);
  };

  const handleSplit = () => {
    trackDecision(Action.Split);

    const currentHand = playerHands[activeHandIndex];
    const splitCard = currentHand.cards[1];

    // Hand 1
    const hand1 = { ...currentHand };
    hand1.cards = [currentHand.cards[0], drawCard()];

    // Hand 2
    const hand2: PlayerHand = {
      id: `hand-${Date.now()}`,
      cards: [splitCard, drawCard()],
      bet: currentHand.bet,
      status: 'playing'
    };

    const newHands = [...playerHands];
    newHands.splice(activeHandIndex, 1, hand1, hand2);
    setPlayerHands(newHands);

    // Check for Aces split rule (usually one card only).
    if (hand1.cards[0].rank === 'A') {
      hand1.status = 'standing';
      hand2.status = 'standing';
      setPlayerHands([...newHands]);
      startDealerTurn();
    }
  };

  const startDealerTurn = async () => {
    setGameState('dealer_turn');

    // Check if all players busted. If so, dealer doesn't need to play (unless to show cards).
    const activeHands = playerHands.filter(h => h.status !== 'busted' && h.status !== 'blackjack');
    if (activeHands.length === 0) {
      setGameState('game_over');
      determineResults([]);
      return;
    }

    // Reveal Logic handled by render (gameState === 'dealer_turn')
    // We need to simulate the loop with delays
    let dHand = [...dealerHand]; // [visible, hidden]

    // Helper for delay
    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    await wait(600); // Initial pause

    let { total, isSoft } = calculateHandValue(dHand);

    // Dealer hits on Soft 17
    while (total < 17 || (total === 17 && isSoft)) {
      await wait(800);
      dHand.push(drawCard());
      setDealerHand([...dHand]);
      const calc = calculateHandValue(dHand);
      total = calc.total;
      isSoft = calc.isSoft;
    }

    await wait(500);
    setGameState('game_over');
    determineResults(dHand);
  };

  const determineResults = (finalDealerHand: CardType[]) => {
    const { total: dTotal } = calculateHandValue(finalDealerHand);

    const newHands = playerHands.map(hand => {
      if (hand.result) return hand; // Already decided (bust/blackjack)

      const { total: pTotal } = calculateHandValue(hand.cards);

      if (dTotal > 21) {
        return { ...hand, result: 'win' as const };
      }

      if (pTotal > dTotal) return { ...hand, result: 'win' as const };
      if (pTotal < dTotal) return { ...hand, result: 'loss' as const };
      return { ...hand, result: 'push' as const };
    });

    setPlayerHands(newHands);

    // Set summary message
    const wins = newHands.filter(h => h.result === 'win').length;
    const losses = newHands.filter(h => h.result === 'loss').length;

    if (wins > losses) {
      setMessage('You Win!');
      playSound('win');
    } else if (losses > wins) {
      setMessage('Dealer Wins.');
      playSound('loss');
    } else {
      setMessage('Push / Break Even.');
      playSound('push');
    }
  };

  // Render Helpers
  const { total: playerTotal, isSoft: playerSoft } = playerHands[activeHandIndex]
    ? calculateHandValue(playerHands[activeHandIndex].cards)
    : { total: 0, isSoft: false };

  const canSplit = gameState === 'player_turn' && playerHands[activeHandIndex] && isStrictPair(playerHands[activeHandIndex].cards) && playerHands.length < 4; // limit splits
  const canDouble = gameState === 'player_turn' && playerHands[activeHandIndex] && playerHands[activeHandIndex].cards.length === 2;

  return (
    <div className="flex flex-col h-full w-full">
      <header className="w-full bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center z-10 shadow-md">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <h1 className="text-xl font-bold text-blue-400 tracking-wider hidden sm:block">PLAYING <span className="text-white font-normal">MODE</span></h1>
        </div>

        {/* Stats Display */}
        <div className="flex gap-4 text-sm sm:text-base font-mono">
          <div className="flex flex-col items-end">
            <span className="text-slate-400 text-xs uppercase">Strategy</span>
            <span className={stats.totalDecisions > 0 && stats.correctDecisions / stats.totalDecisions > 0.9 ? "text-emerald-400" : "text-white"}>
              {stats.totalDecisions === 0 ? '0%' : `${Math.round((stats.correctDecisions / stats.totalDecisions) * 100)}%`}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-slate-400 text-xs uppercase">Streak</span>
            <span className="text-yellow-400">⚡ {stats.currentStreak}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto flex flex-col items-center p-4 relative">

        {/* Dealer Area */}
        <div className="flex flex-col items-center mb-8 mt-4">
          <div className="text-slate-400 text-xs uppercase tracking-widest mb-2">Dealer</div>
          <div className="flex gap-4">
            {dealerHand.map((card, i) => (
              <Card key={card.id} card={card} faceDown={i === 1 && gameState === 'player_turn'} />
            ))}
          </div>
          {gameState !== 'player_turn' && gameState !== 'idle' && (
            <div className="mt-2 text-slate-300 font-mono">
              {calculateHandValue(dealerHand).total}
            </div>
          )}
        </div>

        {/* Player Hands Area */}
        <div className="flex-1 flex items-center justify-center w-full gap-4 sm:gap-8 flex-wrap">
          {gameState === 'idle' ? (
            <div className="text-slate-500 text-lg">Press Deal to start</div>
          ) : (
            playerHands.map((hand, index) => {
              const isActive = index === activeHandIndex && gameState === 'player_turn';
              const { total, isSoft } = calculateHandValue(hand.cards);

              return (
                <div key={hand.id}
                  className={`flex flex-col items-center transition-opacity duration-300 
                            ${isActive ? 'opacity-100 scale-105' : 'opacity-60'}
                            ${hand.result === 'win' ? 'text-emerald-400' : ''}
                            ${hand.result === 'loss' ? 'text-red-400' : ''}
                            `}
                >
                  <div className="mb-2 font-mono text-sm font-bold flex gap-2">
                    <span>{total} {isSoft ? '(Soft)' : ''}</span>
                    {hand.result && <span className="uppercase badge">({hand.result})</span>}
                  </div>
                  <div className="flex gap-2 relative">
                    {hand.cards.map((card, i) => (
                      <div key={card.id} className={i > 0 ? "-ml-12 sm:-ml-16" : ""}>
                        <Card card={card} />
                      </div>
                    ))}
                  </div>
                  {isActive && <div className="mt-4 w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>}
                </div>
              );
            })
          )}
        </div>

        {/* Message Overlay */}
        {message && gameState === 'game_over' && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 px-8 py-4 rounded-xl backdrop-blur-md border border-white/10 shadow-2xl z-20">
            <h2 className="text-2xl font-bold text-white text-center">{message}</h2>
          </div>
        )}

        {/* Controls */}
        <div className="w-full mt-auto py-8">
          {gameState === 'idle' || gameState === 'game_over' ? (
            <div className="flex justify-center">
              <button
                onClick={() => { playSound('click'); dealGame(); }}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-12 rounded-xl text-xl shadow-lg transition-all active:scale-95"
              >
                {gameState === 'idle' ? 'Deal Cards' : 'Play Again'}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3 sm:gap-4 justify-center w-full max-w-2xl px-4 mx-auto">
              {/* Reuse simplified controls layout, but custom logic */}
              <button onClick={() => { playSound('click'); handleHit(); }} disabled={gameState !== 'player_turn'} className="action-btn bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 px-6 rounded-xl min-w-[100px] shadow-md uppercase tracking-wider">Hit</button>
              <button onClick={() => { playSound('click'); handleStand(); }} disabled={gameState !== 'player_turn'} className="action-btn bg-red-600 hover:bg-red-500 text-white font-bold py-4 px-6 rounded-xl min-w-[100px] shadow-md uppercase tracking-wider">Stand</button>
              <button onClick={() => { playSound('click'); handleDouble(); }} disabled={!canDouble} className="action-btn bg-yellow-600 hover:bg-yellow-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-4 px-6 rounded-xl min-w-[100px] shadow-md uppercase tracking-wider">Double</button>
              <button onClick={() => { playSound('click'); handleSplit(); }} disabled={!canSplit} className="action-btn bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-4 px-6 rounded-xl min-w-[100px] shadow-md uppercase tracking-wider">Split</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default PlayingMode;