import { Card, Rank, Suit } from '../types';

export const createDeck = (numDecks: number = 6): Card[] => {
  const deck: Card[] = [];
  const suits = [Suit.Hearts, Suit.Diamonds, Suit.Clubs, Suit.Spades];
  const ranks = Object.values(Rank);

  for (let d = 0; d < numDecks; d++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        let value = 0;
        if (rank === Rank.Ace) value = 11;
        else if ([Rank.Jack, Rank.Queen, Rank.King].includes(rank)) value = 10;
        else value = parseInt(rank, 10);

        deck.push({
          suit,
          rank,
          value,
          id: `${d}-${suit}-${rank}-${Math.random().toString(36).substr(2, 9)}`,
        });
      }
    }
  }
  return deck;
};

export const shuffleDeck = (deck: Card[]): Card[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

export const calculateHandValue = (hand: Card[]): { total: number; isSoft: boolean } => {
  let total = 0;
  let aces = 0;

  for (const card of hand) {
    total += card.value;
    if (card.rank === Rank.Ace) aces += 1;
  }

  // Adjust for Aces
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  // It's a soft hand if we have an Ace counted as 11
  // We can determine this if we used an Ace and didn't reduce it, 
  // OR if we reduced some Aces but still have one counted as 11? 
  // Simpler: It is soft if we have at least one Ace and the total <= 21 treating one Ace as 11.
  // Our calculation above treats Aces as 11 initially. If total <= 21 and we had aces that weren't all reduced, it's soft.
  // Actually, standard check:
  // If we have an Ace, and total <= 21, and if we deducted 10 for *all* aces, the total would be lower by 10 per ace.
  // Correct simple check: It is soft if there is at least one Ace currently contributing 11 to the total.
  // Based on the loop above, if `aces > 0` after the while loop, it means we still have an Ace counted as 11.
  
  return { total, isSoft: aces > 0 };
};

export const isPair = (hand: Card[]): boolean => {
  return hand.length === 2 && hand[0].value === hand[1].value; // Basic value check handles 10-J-Q-K pairs usually treated as 10s for splitting in some variations, but strictly mostly Rank matters.
  // Strictly speaking, usually you split 10s (Rank 10) or Faces. 
  // Most casinos allow splitting any 10-value cards (e.g. J and K).
  // For this exercise, we'll check Rank for perfect pairs or Value for loose pairs.
  // Standard strategy usually talks about "Pair of 10s".
  // Let's use Value for broad compatibility, but note that 10-K is rarely split anyway.
};

export const isStrictPair = (hand: Card[]): boolean => {
    return hand.length === 2 && hand[0].rank === hand[1].rank;
}