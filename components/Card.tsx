import React from 'react';
import { Card as CardType, Suit } from '../types';

interface CardProps {
  card: CardType;
  className?: string;
  faceDown?: boolean;
}

const Card: React.FC<CardProps> = ({ card, className = "", faceDown = false }) => {
  const isRed = card.suit === Suit.Hearts || card.suit === Suit.Diamonds;

  if (faceDown) {
    return (
      <div 
        className={`w-24 h-36 sm:w-32 sm:h-48 rounded-lg border-2 border-white shadow-xl 
        bg-blue-800 flex items-center justify-center ${className}`}
      >
        <div className="w-full h-full opacity-20 bg-[radial-gradient(circle,_#ffffff_1px,_transparent_1px)] bg-[length:10px_10px]"></div>
      </div>
    );
  }

  return (
    <div 
      className={`relative w-24 h-36 sm:w-32 sm:h-48 rounded-lg bg-white border border-gray-300 shadow-xl select-none 
      flex flex-col justify-between p-2 ${className}`}
    >
      {/* Top Left */}
      <div className={`text-xl sm:text-2xl font-bold leading-none ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        <div className="text-center">{card.rank}</div>
        <div className="text-center">{card.suit}</div>
      </div>

      {/* Center Large Suit */}
      <div className={`absolute inset-0 flex items-center justify-center text-6xl sm:text-7xl opacity-20 ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        {card.suit}
      </div>

      {/* Bottom Right (Rotated) */}
      <div className={`text-xl sm:text-2xl font-bold leading-none rotate-180 ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        <div className="text-center">{card.rank}</div>
        <div className="text-center">{card.suit}</div>
      </div>
    </div>
  );
};

export default Card;