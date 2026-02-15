import React, { useState, useEffect, useCallback } from 'react';
import Card from './Card';
import { playSound } from '../utils/sound';
import Controls from './Controls';
import Feedback from './Feedback';
import { createDeck, shuffleDeck, calculateHandValue, isStrictPair } from '../utils/deck';
import { getCorrectAction } from '../utils/strategy';
import { Card as CardType, Action, HandResult, GameStats } from '../types';

interface TrainingModeProps {
  onBack: () => void;
}

const TrainingMode: React.FC<TrainingModeProps> = ({ onBack }) => {
  const [deck, setDeck] = useState<CardType[]>([]);
  const [playerHand, setPlayerHand] = useState<CardType[]>([]);
  const [dealerHand, setDealerHand] = useState<CardType[]>([]);
  const [gameResult, setGameResult] = useState<HandResult | null>(null);
  const [stats, setStats] = useState<GameStats>({ correct: 0, total: 0, streak: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const newDeck = shuffleDeck(createDeck(6));
    setDeck(newDeck);
    setLoading(false);
  }, []);

  const dealHand = useCallback(() => {
    if (deck.length < 15) {
      const newDeck = shuffleDeck(createDeck(6));
      setDeck(newDeck);
    }

    const currentDeck = [...deck];
    if (currentDeck.length < 10) {
      const newD = shuffleDeck(createDeck(6));
      setDeck(newD);
      return;
    }

    const p1 = currentDeck.pop()!;
    const d1 = currentDeck.pop()!;
    const p2 = currentDeck.pop()!;

    setPlayerHand([p1, p2]);
    setDealerHand([d1]);
    setDeck(currentDeck);
    setGameResult(null);
  }, [deck]);

  useEffect(() => {
    if (!loading && playerHand.length === 0) {
      dealHand();
    }
  }, [loading, dealHand, playerHand.length]);

  const handleAction = (action: Action) => {
    if (gameResult) return;

    const dealerUpCard = dealerHand[0];
    const { action: correctAction, reason, analysis, example } = getCorrectAction(playerHand, dealerUpCard);
    const isCorrect = action === correctAction;

    setStats(prev => ({
      total: prev.total + 1,
      correct: prev.correct + (isCorrect ? 1 : 0),
      streak: isCorrect ? prev.streak + 1 : 0
    }));

    playSound(isCorrect ? 'win' : 'loss');

    setGameResult({
      isCorrect,
      userAction: action,
      correctAction,
      explanation: reason,
      analysis,
      example
    });
  };

  const { total, isSoft } = calculateHandValue(playerHand);
  const canSplit = isStrictPair(playerHand);
  const canDouble = playerHand.length === 2;

  if (loading) return <div className="flex h-full items-center justify-center text-white">Loading...</div>;

  return (
    <div className="flex flex-col h-full w-full">
      <header className="w-full bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center z-10 shadow-md">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <h1 className="text-xl font-bold text-emerald-400 tracking-wider hidden sm:block">TRAINING <span className="text-white font-normal">MODE</span></h1>
        </div>

        <div className="flex gap-4 text-sm sm:text-base font-mono">
          <div className="flex flex-col items-end">
            <span className="text-slate-400 text-xs uppercase">Accuracy</span>
            <span className={stats.total > 0 && stats.correct / stats.total > 0.9 ? "text-emerald-400" : "text-white"}>
              {stats.total === 0 ? '0%' : `${Math.round((stats.correct / stats.total) * 100)}%`}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-slate-400 text-xs uppercase">Streak</span>
            <span className="text-yellow-400">🔥 {stats.streak}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto flex flex-col items-center justify-center p-4 relative">
        <div className="flex flex-col items-center mb-8 sm:mb-12">
          <div className="text-slate-400 text-sm uppercase tracking-widest mb-4">Dealer Upcard</div>
          <div className="flex gap-4">
            {dealerHand.map(card => (
              <Card key={card.id} card={card} />
            ))}
            <Card card={{ ...dealerHand[0], id: 'hole' }} faceDown className="opacity-50" />
          </div>
        </div>

        <div className="flex flex-col items-center mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-slate-400 text-sm uppercase tracking-widest">Your Hand</div>
            <div className="bg-slate-700 text-white px-2 py-0.5 rounded text-xs font-mono">
              {total} {isSoft ? '(Soft)' : ''}
            </div>
          </div>
          <div className="flex gap-4">
            {playerHand.map(card => (
              <Card key={card.id} card={card} />
            ))}
          </div>
        </div>

        <div className="w-full mt-auto mb-8 sm:mb-12">
          <Controls
            onAction={handleAction}
            canDouble={canDouble}
            canSplit={canSplit}
            disabled={!!gameResult}
          />
        </div>
      </main>

      <footer className="w-full text-center p-4 text-slate-600 text-xs">
        Basic Strategy (H17, 6 Decks) • Instant Feedback
      </footer>

      {gameResult && (
        <Feedback result={gameResult} onNext={dealHand} />
      )}
    </div>
  );
};

export default TrainingMode;