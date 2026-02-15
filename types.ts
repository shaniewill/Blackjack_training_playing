export enum Suit {
  Hearts = '♥',
  Diamonds = '♦',
  Clubs = '♣',
  Spades = '♠',
}

export enum Rank {
  Two = '2',
  Three = '3',
  Four = '4',
  Five = '5',
  Six = '6',
  Seven = '7',
  Eight = '8',
  Nine = '9',
  Ten = '10',
  Jack = 'J',
  Queen = 'Q',
  King = 'K',
  Ace = 'A',
}

export interface Card {
  suit: Suit;
  rank: Rank;
  value: number; // 2-10, 10 for JQK, 11 for A (initially)
  id: string; // unique identifier for React keys
}

export enum Action {
  Hit = 'Hit',
  Stand = 'Stand',
  Double = 'Double',
  Split = 'Split',
}

export interface HandResult {
  isCorrect: boolean;
  userAction: Action;
  correctAction: Action;
  explanation: string;
  analysis: string;
  example: string;
}

export interface GameStats {
  correct: number;
  total: number;
  streak: number;
}

// Playing Mode Types
export interface PlayerHand {
  id: string;
  cards: Card[];
  bet: number;
  status: 'playing' | 'standing' | 'busted' | 'blackjack' | 'doubled';
  result?: 'win' | 'loss' | 'push';
}

export type GameState = 'idle' | 'dealing' | 'player_turn' | 'dealer_turn' | 'game_over';
