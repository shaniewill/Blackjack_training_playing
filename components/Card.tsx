import React from 'react';
import { Card as CardType, Suit } from '../types';

interface CardProps {
  card: CardType;
  className?: string;
  faceDown?: boolean;
  compact?: boolean;
}

/* Pip positions as [x%, y%, flipped?] — standard playing card layouts */
type Pip = [number, number, boolean?];
const PIPS: Record<string, Pip[]> = {
  'A': [[50, 50]],
  '2': [[50, 18], [50, 82, true]],
  '3': [[50, 18], [50, 50], [50, 82, true]],
  '4': [[30, 18], [70, 18], [30, 82, true], [70, 82, true]],
  '5': [[30, 18], [70, 18], [50, 50], [30, 82, true], [70, 82, true]],
  '6': [[30, 18], [70, 18], [30, 50], [70, 50], [30, 82, true], [70, 82, true]],
  '7': [[30, 18], [70, 18], [50, 34], [30, 50], [70, 50], [30, 82, true], [70, 82, true]],
  '8': [[30, 18], [70, 18], [50, 34], [30, 50], [70, 50], [50, 66, true], [30, 82, true], [70, 82, true]],
  '9': [[30, 18], [70, 18], [30, 39], [70, 39], [50, 50], [30, 61, true], [70, 61, true], [30, 82, true], [70, 82, true]],
  '10': [[30, 18], [70, 18], [50, 28], [30, 39], [70, 39], [30, 61, true], [70, 61, true], [50, 72, true], [30, 82, true], [70, 82, true]],
};

/* SVG face card illustrations — stylized traditional court card portraits */
const JackSVG: React.FC<{ isRed: boolean }> = ({ isRed }) => {
  const primary = isRed ? '#DC2626' : '#1E40AF';
  const primaryDark = isRed ? '#991B1B' : '#1E3A8A';
  const bg = isRed ? '#FEF3C7' : '#EFF6FF';
  return (
    <svg viewBox="0 0 100 140" className="w-full h-full" preserveAspectRatio="none">
      <rect x="0" y="0" width="100" height="140" fill={bg} />
      {/* Divider line */}
      <line x1="0" y1="70" x2="100" y2="70" stroke={primary} strokeWidth="0.5" opacity="0.3" />
      {/* ── Top half ── */}
      <g>
        {/* Hat — beret style */}
        <ellipse cx="50" cy="12" rx="20" ry="6" fill={primary} />
        <path d="M30 12 Q30 4 50 2 Q70 4 70 12" fill={primary} />
        <circle cx="50" cy="4" r="3" fill="#F59E0B" />
        {/* Feather */}
        <path d="M65 8 Q78 -2 82 6" fill="none" stroke="#F59E0B" strokeWidth="1.5" />
        <path d="M65 8 Q76 2 80 10" fill="none" stroke="#D97706" strokeWidth="1" />
        {/* Face */}
        <ellipse cx="50" cy="28" rx="14" ry="15" fill="#FDE68A" stroke="#B45309" strokeWidth="0.8" />
        {/* Hair curls */}
        <path d="M36 22 Q32 18 34 14" fill="none" stroke="#78350F" strokeWidth="2" />
        <path d="M64 22 Q68 18 66 14" fill="none" stroke="#78350F" strokeWidth="2" />
        {/* Eyes */}
        <ellipse cx="44" cy="26" rx="2" ry="1.5" fill="#1E293B" />
        <ellipse cx="56" cy="26" rx="2" ry="1.5" fill="#1E293B" />
        <circle cx="44" cy="25.5" r="0.6" fill="white" />
        <circle cx="56" cy="25.5" r="0.6" fill="white" />
        {/* Nose & mouth */}
        <path d="M48 30 L50 33 L52 30" fill="none" stroke="#92400E" strokeWidth="0.8" />
        <path d="M46 36 Q50 38 54 36" fill="none" stroke="#92400E" strokeWidth="0.8" />
        {/* Collar */}
        <path d="M36 42 L50 48 L64 42" fill={primary} stroke={primaryDark} strokeWidth="0.8" />
        <path d="M38 42 L50 46 L62 42" fill="none" stroke="#F59E0B" strokeWidth="0.5" />
        {/* Tunic */}
        <rect x="28" y="46" width="44" height="24" fill={primary} />
        {/* Belt */}
        <rect x="28" y="56" width="44" height="4" fill="#F59E0B" stroke="#B45309" strokeWidth="0.5" />
        <circle cx="50" cy="58" r="2" fill="#B45309" />
        {/* Buttons */}
        <circle cx="50" cy="50" r="1.5" fill="#F59E0B" />
        {/* Sword held diagonally */}
        <line x1="68" y1="30" x2="80" y2="65" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
        <line x1="72" y1="44" x2="80" y2="42" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      {/* ── Bottom half (mirrored) ── */}
      <g transform="translate(100,140) rotate(180)">
        <g>
          <ellipse cx="50" cy="12" rx="20" ry="6" fill={primary} />
          <path d="M30 12 Q30 4 50 2 Q70 4 70 12" fill={primary} />
          <circle cx="50" cy="4" r="3" fill="#F59E0B" />
          <path d="M65 8 Q78 -2 82 6" fill="none" stroke="#F59E0B" strokeWidth="1.5" />
          <path d="M65 8 Q76 2 80 10" fill="none" stroke="#D97706" strokeWidth="1" />
          <ellipse cx="50" cy="28" rx="14" ry="15" fill="#FDE68A" stroke="#B45309" strokeWidth="0.8" />
          <path d="M36 22 Q32 18 34 14" fill="none" stroke="#78350F" strokeWidth="2" />
          <path d="M64 22 Q68 18 66 14" fill="none" stroke="#78350F" strokeWidth="2" />
          <ellipse cx="44" cy="26" rx="2" ry="1.5" fill="#1E293B" />
          <ellipse cx="56" cy="26" rx="2" ry="1.5" fill="#1E293B" />
          <circle cx="44" cy="25.5" r="0.6" fill="white" />
          <circle cx="56" cy="25.5" r="0.6" fill="white" />
          <path d="M48 30 L50 33 L52 30" fill="none" stroke="#92400E" strokeWidth="0.8" />
          <path d="M46 36 Q50 38 54 36" fill="none" stroke="#92400E" strokeWidth="0.8" />
          <path d="M36 42 L50 48 L64 42" fill={primary} stroke={primaryDark} strokeWidth="0.8" />
          <path d="M38 42 L50 46 L62 42" fill="none" stroke="#F59E0B" strokeWidth="0.5" />
          <rect x="28" y="46" width="44" height="24" fill={primary} />
          <rect x="28" y="56" width="44" height="4" fill="#F59E0B" stroke="#B45309" strokeWidth="0.5" />
          <circle cx="50" cy="58" r="2" fill="#B45309" />
          <circle cx="50" cy="50" r="1.5" fill="#F59E0B" />
          <line x1="68" y1="30" x2="80" y2="65" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
          <line x1="72" y1="44" x2="80" y2="42" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
};

const QueenSVG: React.FC<{ isRed: boolean }> = ({ isRed }) => {
  const primary = isRed ? '#DC2626' : '#1E40AF';
  const primaryDark = isRed ? '#991B1B' : '#1E3A8A';
  const bg = isRed ? '#FEF3C7' : '#EFF6FF';
  return (
    <svg viewBox="0 0 100 140" className="w-full h-full" preserveAspectRatio="none">
      <rect x="0" y="0" width="100" height="140" fill={bg} />
      <line x1="0" y1="70" x2="100" y2="70" stroke={primary} strokeWidth="0.5" opacity="0.3" />
      {/* ── Top half ── */}
      <g>
        {/* Crown */}
        <path d="M30 16 L36 4 L42 12 L50 0 L58 12 L64 4 L70 16 Z" fill="#F59E0B" stroke="#B45309" strokeWidth="0.8" />
        <rect x="30" y="14" width="40" height="4" rx="1" fill="#F59E0B" stroke="#B45309" strokeWidth="0.5" />
        <circle cx="50" cy="3" r="2" fill="#DC2626" />
        <circle cx="36" cy="6" r="1.5" fill="#3B82F6" />
        <circle cx="64" cy="6" r="1.5" fill="#3B82F6" />
        {/* Face */}
        <ellipse cx="50" cy="30" rx="14" ry="14" fill="#FDE68A" stroke="#B45309" strokeWidth="0.8" />
        {/* Hair — long flowing */}
        <path d="M36 24 Q28 16 32 10" fill="none" stroke="#78350F" strokeWidth="2.5" />
        <path d="M64 24 Q72 16 68 10" fill="none" stroke="#78350F" strokeWidth="2.5" />
        <path d="M36 32 Q26 40 28 50" fill="none" stroke="#78350F" strokeWidth="2" />
        <path d="M64 32 Q74 40 72 50" fill="none" stroke="#78350F" strokeWidth="2" />
        {/* Eyes */}
        <ellipse cx="44" cy="28" rx="2" ry="1.5" fill="#1E293B" />
        <ellipse cx="56" cy="28" rx="2" ry="1.5" fill="#1E293B" />
        <circle cx="44" cy="27.5" r="0.6" fill="white" />
        <circle cx="56" cy="27.5" r="0.6" fill="white" />
        {/* Eyelashes */}
        <path d="M41 25.5 L43 27" stroke="#1E293B" strokeWidth="0.6" />
        <path d="M59 25.5 L57 27" stroke="#1E293B" strokeWidth="0.6" />
        {/* Nose & mouth */}
        <path d="M48 31 L50 34 L52 31" fill="none" stroke="#92400E" strokeWidth="0.8" />
        <path d="M46 37 Q50 40 54 37" fill="none" stroke="#B91C1C" strokeWidth="1" />
        {/* Necklace */}
        <path d="M38 44 Q50 50 62 44" fill="none" stroke="#F59E0B" strokeWidth="1.5" />
        <circle cx="50" cy="48" r="2.5" fill="#DC2626" stroke="#B91C1C" strokeWidth="0.5" />
        {/* Dress */}
        <path d="M24 46 L24 70 L76 70 L76 46 Q62 56 50 52 Q38 56 24 46" fill={primary} />
        {/* Dress V-neckline */}
        <path d="M36 44 L50 52 L64 44" fill={primary} stroke={primaryDark} strokeWidth="0.8" />
        {/* Scepter / rose */}
        <line x1="20" y1="34" x2="16" y2="62" stroke="#16A34A" strokeWidth="1.5" />
        <circle cx="20" cy="32" r="4" fill={isRed ? '#DC2626' : '#F59E0B'} stroke={isRed ? '#991B1B' : '#B45309'} strokeWidth="0.8" />
        <circle cx="20" cy="32" r="1.5" fill="#F59E0B" />
        {/* Dress decorations */}
        <path d="M44 60 L50 56 L56 60 L50 64 Z" fill="#F59E0B" stroke="#B45309" strokeWidth="0.5" />
      </g>
      {/* ── Bottom half (mirrored) ── */}
      <g transform="translate(100,140) rotate(180)">
        <g>
          <path d="M30 16 L36 4 L42 12 L50 0 L58 12 L64 4 L70 16 Z" fill="#F59E0B" stroke="#B45309" strokeWidth="0.8" />
          <rect x="30" y="14" width="40" height="4" rx="1" fill="#F59E0B" stroke="#B45309" strokeWidth="0.5" />
          <circle cx="50" cy="3" r="2" fill="#DC2626" />
          <circle cx="36" cy="6" r="1.5" fill="#3B82F6" />
          <circle cx="64" cy="6" r="1.5" fill="#3B82F6" />
          <ellipse cx="50" cy="30" rx="14" ry="14" fill="#FDE68A" stroke="#B45309" strokeWidth="0.8" />
          <path d="M36 24 Q28 16 32 10" fill="none" stroke="#78350F" strokeWidth="2.5" />
          <path d="M64 24 Q72 16 68 10" fill="none" stroke="#78350F" strokeWidth="2.5" />
          <path d="M36 32 Q26 40 28 50" fill="none" stroke="#78350F" strokeWidth="2" />
          <path d="M64 32 Q74 40 72 50" fill="none" stroke="#78350F" strokeWidth="2" />
          <ellipse cx="44" cy="28" rx="2" ry="1.5" fill="#1E293B" />
          <ellipse cx="56" cy="28" rx="2" ry="1.5" fill="#1E293B" />
          <circle cx="44" cy="27.5" r="0.6" fill="white" />
          <circle cx="56" cy="27.5" r="0.6" fill="white" />
          <path d="M41 25.5 L43 27" stroke="#1E293B" strokeWidth="0.6" />
          <path d="M59 25.5 L57 27" stroke="#1E293B" strokeWidth="0.6" />
          <path d="M48 31 L50 34 L52 31" fill="none" stroke="#92400E" strokeWidth="0.8" />
          <path d="M46 37 Q50 40 54 37" fill="none" stroke="#B91C1C" strokeWidth="1" />
          <path d="M38 44 Q50 50 62 44" fill="none" stroke="#F59E0B" strokeWidth="1.5" />
          <circle cx="50" cy="48" r="2.5" fill="#DC2626" stroke="#B91C1C" strokeWidth="0.5" />
          <path d="M24 46 L24 70 L76 70 L76 46 Q62 56 50 52 Q38 56 24 46" fill={primary} />
          <path d="M36 44 L50 52 L64 44" fill={primary} stroke={primaryDark} strokeWidth="0.8" />
          <line x1="20" y1="34" x2="16" y2="62" stroke="#16A34A" strokeWidth="1.5" />
          <circle cx="20" cy="32" r="4" fill={isRed ? '#DC2626' : '#F59E0B'} stroke={isRed ? '#991B1B' : '#B45309'} strokeWidth="0.8" />
          <circle cx="20" cy="32" r="1.5" fill="#F59E0B" />
          <path d="M44 60 L50 56 L56 60 L50 64 Z" fill="#F59E0B" stroke="#B45309" strokeWidth="0.5" />
        </g>
      </g>
    </svg>
  );
};

const KingSVG: React.FC<{ isRed: boolean }> = ({ isRed }) => {
  const primary = isRed ? '#DC2626' : '#1E40AF';
  const primaryDark = isRed ? '#991B1B' : '#1E3A8A';
  const bg = isRed ? '#FEF3C7' : '#EFF6FF';
  return (
    <svg viewBox="0 0 100 140" className="w-full h-full" preserveAspectRatio="none">
      <rect x="0" y="0" width="100" height="140" fill={bg} />
      <line x1="0" y1="70" x2="100" y2="70" stroke={primary} strokeWidth="0.5" opacity="0.3" />
      {/* ── Top half ── */}
      <g>
        {/* Crown — large & ornate */}
        <path d="M26 18 L30 2 L38 12 L50 -2 L62 12 L70 2 L74 18 Z" fill="#F59E0B" stroke="#B45309" strokeWidth="0.8" />
        <rect x="28" y="16" width="44" height="5" rx="1" fill="#F59E0B" stroke="#B45309" strokeWidth="0.5" />
        <circle cx="50" cy="2" r="2.5" fill="#DC2626" />
        <circle cx="38" cy="8" r="1.5" fill="#DC2626" />
        <circle cx="62" cy="8" r="1.5" fill="#3B82F6" />
        <circle cx="50" cy="10" r="1.5" fill="#3B82F6" />
        {/* Face */}
        <ellipse cx="50" cy="34" rx="15" ry="15" fill="#FDE68A" stroke="#B45309" strokeWidth="0.8" />
        {/* Eyes */}
        <ellipse cx="44" cy="32" rx="2" ry="1.5" fill="#1E293B" />
        <ellipse cx="56" cy="32" rx="2" ry="1.5" fill="#1E293B" />
        <circle cx="44" cy="31.5" r="0.6" fill="white" />
        <circle cx="56" cy="31.5" r="0.6" fill="white" />
        {/* Eyebrows — stern */}
        <path d="M40 28.5 L48 28" stroke="#1E293B" strokeWidth="1" />
        <path d="M60 28.5 L52 28" stroke="#1E293B" strokeWidth="1" />
        {/* Nose & mouth */}
        <path d="M48 35 L50 38 L52 35" fill="none" stroke="#92400E" strokeWidth="0.8" />
        <path d="M46 41 L54 41" stroke="#92400E" strokeWidth="0.8" />
        {/* Beard */}
        <path d="M36 40 Q38 54 50 56 Q62 54 64 40" fill="none" stroke="#78350F" strokeWidth="2" />
        <path d="M40 46 Q50 54 60 46" fill="none" stroke="#78350F" strokeWidth="1.2" />
        <path d="M44 50 Q50 56 56 50" fill="none" stroke="#78350F" strokeWidth="1" />
        {/* Robe */}
        <path d="M20 52 L20 70 L80 70 L80 52 Q64 62 50 58 Q36 62 20 52" fill={primary} />
        {/* Ermine collar */}
        <path d="M30 48 Q40 56 50 52 Q60 56 70 48" fill="none" stroke="#F59E0B" strokeWidth="3" />
        <path d="M30 48 Q40 56 50 52 Q60 56 70 48" fill="none" stroke={primaryDark} strokeWidth="0.5" />
        {/* Sword — behind the king */}
        <rect x="74" y="28" width="3" height="40" rx="1" fill="#94A3B8" stroke="#64748B" strokeWidth="0.5" />
        <rect x="70" y="38" width="11" height="4" rx="1" fill="#F59E0B" stroke="#B45309" strokeWidth="0.5" />
        <circle cx="75.5" cy="30" r="2" fill="#F59E0B" stroke="#B45309" strokeWidth="0.5" />
        {/* Chest medallion */}
        <path d="M44 62 L50 57 L56 62 L50 67 Z" fill="#F59E0B" stroke="#B45309" strokeWidth="0.5" />
        <circle cx="50" cy="62" r="2" fill="#DC2626" />
      </g>
      {/* ── Bottom half (mirrored) ── */}
      <g transform="translate(100,140) rotate(180)">
        <g>
          <path d="M26 18 L30 2 L38 12 L50 -2 L62 12 L70 2 L74 18 Z" fill="#F59E0B" stroke="#B45309" strokeWidth="0.8" />
          <rect x="28" y="16" width="44" height="5" rx="1" fill="#F59E0B" stroke="#B45309" strokeWidth="0.5" />
          <circle cx="50" cy="2" r="2.5" fill="#DC2626" />
          <circle cx="38" cy="8" r="1.5" fill="#DC2626" />
          <circle cx="62" cy="8" r="1.5" fill="#3B82F6" />
          <circle cx="50" cy="10" r="1.5" fill="#3B82F6" />
          <ellipse cx="50" cy="34" rx="15" ry="15" fill="#FDE68A" stroke="#B45309" strokeWidth="0.8" />
          <ellipse cx="44" cy="32" rx="2" ry="1.5" fill="#1E293B" />
          <ellipse cx="56" cy="32" rx="2" ry="1.5" fill="#1E293B" />
          <circle cx="44" cy="31.5" r="0.6" fill="white" />
          <circle cx="56" cy="31.5" r="0.6" fill="white" />
          <path d="M40 28.5 L48 28" stroke="#1E293B" strokeWidth="1" />
          <path d="M60 28.5 L52 28" stroke="#1E293B" strokeWidth="1" />
          <path d="M48 35 L50 38 L52 35" fill="none" stroke="#92400E" strokeWidth="0.8" />
          <path d="M46 41 L54 41" stroke="#92400E" strokeWidth="0.8" />
          <path d="M36 40 Q38 54 50 56 Q62 54 64 40" fill="none" stroke="#78350F" strokeWidth="2" />
          <path d="M40 46 Q50 54 60 46" fill="none" stroke="#78350F" strokeWidth="1.2" />
          <path d="M44 50 Q50 56 56 50" fill="none" stroke="#78350F" strokeWidth="1" />
          <path d="M20 52 L20 70 L80 70 L80 52 Q64 62 50 58 Q36 62 20 52" fill={primary} />
          <path d="M30 48 Q40 56 50 52 Q60 56 70 48" fill="none" stroke="#F59E0B" strokeWidth="3" />
          <path d="M30 48 Q40 56 50 52 Q60 56 70 48" fill="none" stroke={primaryDark} strokeWidth="0.5" />
          <rect x="74" y="28" width="3" height="40" rx="1" fill="#94A3B8" stroke="#64748B" strokeWidth="0.5" />
          <rect x="70" y="38" width="11" height="4" rx="1" fill="#F59E0B" stroke="#B45309" strokeWidth="0.5" />
          <circle cx="75.5" cy="30" r="2" fill="#F59E0B" stroke="#B45309" strokeWidth="0.5" />
          <path d="M44 62 L50 57 L56 62 L50 67 Z" fill="#F59E0B" stroke="#B45309" strokeWidth="0.5" />
          <circle cx="50" cy="62" r="2" fill="#DC2626" />
        </g>
      </g>
    </svg>
  );
};

const FACE_SVG: Record<string, React.FC<{ isRed: boolean }>> = {
  'J': JackSVG,
  'Q': QueenSVG,
  'K': KingSVG,
};

const Card: React.FC<CardProps> = ({ card, className = "", faceDown = false, compact = false }) => {
  const isRed = card.suit === Suit.Hearts || card.suit === Suit.Diamonds;
  const color = isRed ? 'text-red-600' : 'text-slate-900';

  const sizeClass = compact
    ? 'w-14 h-[84px] sm:w-16 sm:h-24 rounded-md'
    : 'w-24 h-36 sm:w-32 sm:h-48 rounded-lg';

  if (faceDown) {
    return (
      <div className={`${sizeClass} border-2 border-white shadow-lg bg-blue-800 flex items-center justify-center overflow-hidden ${className}`}>
        <div className={`w-full h-full opacity-20 bg-[radial-gradient(circle,_#ffffff_1px,_transparent_1px)] ${compact ? 'bg-[length:6px_6px]' : 'bg-[length:10px_10px]'}`} />
      </div>
    );
  }

  const isFace = ['J', 'Q', 'K'].includes(card.rank);
  const isAce = card.rank === 'A';
  const pips = PIPS[card.rank];

  // Size tokens
  const cornerRankSize = compact ? 'text-xs sm:text-sm' : 'text-lg sm:text-xl';
  const cornerSuitSize = compact ? 'text-[8px] sm:text-[10px]' : 'text-sm sm:text-base';
  const pipSize = compact ? 'text-[8px] sm:text-[10px]' : 'text-sm sm:text-base';
  const acePipSize = compact ? 'text-xl sm:text-2xl' : 'text-4xl sm:text-5xl';

  const FaceSVG = isFace ? FACE_SVG[card.rank] : null;

  return (
    <div className={`relative ${sizeClass} bg-white border border-gray-200 shadow-lg select-none overflow-hidden ${className}`}>

      {/* ── Top-left corner ── */}
      <div className={`absolute ${compact ? 'top-[1px] left-[2px]' : 'top-0.5 left-1 sm:top-1 sm:left-1.5'} flex flex-col items-center leading-none ${color} z-10`}>
        <span className={`${cornerRankSize} font-bold`}>{card.rank}</span>
        <span className={`${cornerSuitSize} ${compact ? '-mt-[1px]' : '-mt-0.5'}`}>{card.suit}</span>
      </div>

      {/* ── Bottom-right corner (rotated) ── */}
      <div className={`absolute ${compact ? 'bottom-[1px] right-[2px]' : 'bottom-0.5 right-1 sm:bottom-1 sm:right-1.5'} flex flex-col items-center leading-none ${color} rotate-180 z-10`}>
        <span className={`${cornerRankSize} font-bold`}>{card.rank}</span>
        <span className={`${cornerSuitSize} ${compact ? '-mt-[1px]' : '-mt-0.5'}`}>{card.suit}</span>
      </div>

      {/* ── Inner frame area ── */}
      <div className={`absolute ${compact ? 'inset-x-[12px] inset-y-[14px] sm:inset-x-[14px] sm:inset-y-[16px]' : 'inset-x-[18px] inset-y-[22px] sm:inset-x-[24px] sm:inset-y-[28px]'} border ${isRed ? 'border-red-200' : 'border-slate-200'} rounded-sm overflow-hidden`}>

        {/* ── Ace ── */}
        {isAce && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`${acePipSize} ${color}`}>{card.suit}</span>
          </div>
        )}

        {/* ── Face cards — SVG illustrations ── */}
        {isFace && FaceSVG && (
          <div className="absolute inset-0 overflow-hidden rounded-sm">
            <FaceSVG isRed={isRed} />
          </div>
        )}

        {/* ── Number pips ── */}
        {pips && !isAce && !isFace && (
          <div className="absolute inset-0">
            {pips.map(([x, y, flip], i) => (
              <span
                key={i}
                className={`absolute ${pipSize} ${color} leading-none`}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: `translate(-50%, -50%)${flip ? ' rotate(180deg)' : ''}`,
                }}
              >
                {card.suit}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Card;