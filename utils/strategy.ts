import { Action, Card } from '../types';
import { calculateHandValue, isStrictPair } from './deck';

// H17 Strategy: Dealer Hits Soft 17
// 6 Decks

interface StrategyDecision {
  action: Action;
  reason: string;
  analysis: string;
  example: string;
}

const decision = (action: Action, reason: string, analysis: string, example: string): StrategyDecision => ({
  action, reason, analysis, example
});

export const getCorrectAction = (playerHand: Card[], dealerUpCard: Card): StrategyDecision => {
  const { total, isSoft } = calculateHandValue(playerHand);
  const dealerVal = dealerUpCard.value; // 2-11 (A is 11)
  const isPairHand = isStrictPair(playerHand);
  
  // 1. PAIR SPLITTING
  if (isPairHand) {
    const pairVal = playerHand[0].value; // 2-11 (Ace is 11)
    
    // Aces
    if (pairVal === 11) {
        return decision(Action.Split, "Always split Aces.", 
        "Splitting Aces turns one mediocre soft hand (12) into two powerful starting hands. Each Ace counts as 11, meaning any 10-value card gives you 21.", 
        "Example: Player [A, A] vs Dealer [8]");
    }
    // 8s
    if (pairVal === 8) {
        return decision(Action.Split, "Always split 8s.", 
        "A hard 16 is widely considered the worst hand in Blackjack. Splitting 8s breaks this up and gives you two hands starting with 8, which has a much higher expected value than playing the 16.", 
        "Example: Player [8, 8] vs Dealer [10]");
    }
    // 2s and 3s
    if (pairVal === 2 || pairVal === 3) {
      if (dealerVal >= 2 && dealerVal <= 7) {
          return decision(Action.Split, `Split ${pairVal}s against dealer 2-7.`, 
          "Against a weak dealer card, splitting small pairs allows you to put more money on the table with decent starting hands. Hitting would just give you one weak total.", 
          `Example: Player [${pairVal}, ${pairVal}] vs Dealer [5]`);
      }
      return decision(Action.Hit, `Hit ${pairVal}s against dealer ${dealerVal}.`, 
      "Against a strong dealer card (8+), splitting is too risky as you are likely to end up with two losing hands. Hitting gives you a safer chance to improve without doubling your exposure.", 
      `Example: Player [${pairVal}, ${pairVal}] vs Dealer [9]`);
    }
    // 4s
    if (pairVal === 4) {
      return decision(Action.Hit, "Hit pair of 4s.", 
      "A pair of 4s equals 8, which is a decent platform to hit from. Splitting leaves you with two hands starting with 4, which often result in stiff totals (14) if you catch a 10.", 
      "Example: Player [4, 4] vs Dealer [6]");
    }
    // 5s (Total 10)
    if (pairVal === 5) {
      if (dealerVal <= 9) {
          return decision(Action.Double, "Double pair of 5s (Hard 10) against 2-9.", 
          "A pair of 5s is mathematically a Hard 10. This is a very strong total. You should double to maximize profit against a dealer who isn't showing a 10 or Ace.", 
          "Example: Player [5, 5] vs Dealer [7]");
      }
      return decision(Action.Hit, "Hit pair of 5s (Hard 10) against 10 or Ace.", 
      "While 10 is strong, doubling against a dealer 10 or Ace is too risky. Simply hit to take a card.", 
      "Example: Player [5, 5] vs Dealer [A]");
    }
    // 6s
    if (pairVal === 6) {
        if (dealerVal >= 2 && dealerVal <= 6) {
            return decision(Action.Split, "Split 6s against 2-6.", 
            "A hard 12 is a difficult hand. Against a weak dealer who might bust, splitting 6s reduces your chance of busting immediately and gives you two shots at a better total.", 
            "Example: Player [6, 6] vs Dealer [4]");
        }
        return decision(Action.Hit, "Hit 6s against 7+.", 
        "Against a strong dealer, splitting 6s is suicidal. You are better off playing the 12 and hoping for a decent hit than paying double to start with two 6s.", 
        "Example: Player [6, 6] vs Dealer [8]");
    }
    // 7s
    if (pairVal === 7) {
        if (dealerVal >= 2 && dealerVal <= 7) {
            return decision(Action.Split, "Split 7s against 2-7.", 
            "A hard 14 is a 'stiff' hand. Splitting 7s against a dealer 2-7 is offensive; you turn a likely loser into two hands that can easily become 17s.", 
            "Example: Player [7, 7] vs Dealer [5]");
        }
        return decision(Action.Hit, "Hit 7s against 8+.", 
        "14 is a bad hand, but splitting into two 7s against a dealer 8, 9, or 10 just creates two losing hands. Hit and hope for a small card.", 
        "Example: Player [7, 7] vs Dealer [K]");
    }
    // 9s
    if (pairVal === 9) {
        if ((dealerVal >= 2 && dealerVal <= 6) || (dealerVal >= 8 && dealerVal <= 9)) {
            return decision(Action.Split, "Split 9s against 2-6 and 8-9.", 
            "18 is a good hand, but starting with 9 is often better. You split vs 2-6 to extract value, and vs 8-9 because your 18 might lose or push, but starting with 9 gives you a chance to beat their potential 18/19.", 
            "Example: Player [9, 9] vs Dealer [9]");
        }
        return decision(Action.Stand, "Stand on 9s against 7, 10, or Ace.", 
        "Against a 7, your 18 likely wins. Against 10 or A, your 18 is an underdog, but splitting just exposes more money to a likely loss.", 
        "Example: Player [9, 9] vs Dealer [7]");
    }
    // 10s
    if (pairVal === 10) {
        return decision(Action.Stand, "Always stand on 20.", 
        "20 is the second-best hand in the game. Never risk splitting it. You will win the vast majority of these hands.", 
        "Example: Player [K, J] vs Dealer [6]");
    }
  }

  // 2. SOFT TOTALS
  if (isSoft) {
    // Soft 20 (A,9)
    if (total >= 20) return decision(Action.Stand, "Always stand on Soft 20 or greater.", 
        "You have an excellent total. There is no mathematical reason to mess with a winning hand.", 
        "Example: Player [A, 9] vs Dealer [5]");
    
    // Soft 19 (A,8)
    if (total === 19) {
        if (dealerVal === 6) {
            return decision(Action.Double, "Double Soft 19 against 6 (H17 rule).", 
            "Under H17 rules, doubling Soft 19 against a 6 is slightly profitable because the dealer is very weak. In S17 games, you would stand.", 
            "Example: Player [A, 8] vs Dealer [6]");
        }
        return decision(Action.Stand, "Stand on Soft 19.", 
        "19 is a strong winning total. Take the likely win.", 
        "Example: Player [A, 8] vs Dealer [9]");
    }

    // Soft 18 (A,7)
    if (total === 18) {
        if (dealerVal >= 2 && dealerVal <= 6) {
            return decision(Action.Double, "Double Soft 18 against 2-6.", 
            "You have a decent hand (18), but the dealer is weak. Doubling allows you to buy a chance for a great hand (using the Ace flexibility) while capitalizing on the dealer's bust potential.", 
            "Example: Player [A, 7] vs Dealer [4]");
        }
        if (dealerVal >= 9) {
            return decision(Action.Hit, "Hit Soft 18 against 9, 10, A.", 
            "18 is often a losing hand against a strong dealer card (who likely has 19 or 20). You must hit to try and get 19, 20, or 21.", 
            "Example: Player [A, 7] vs Dealer [K]");
        }
        return decision(Action.Stand, "Stand Soft 18 against 7, 8.", 
        "Against a dealer 7 or 8, your 18 is likely a winner or push. Doubling is too risky, and hitting is unnecessary.", 
        "Example: Player [A, 7] vs Dealer [7]");
    }

    // Soft 17 (A,6)
    if (total === 17) {
        if (dealerVal >= 3 && dealerVal <= 6) {
            return decision(Action.Double, "Double Soft 17 against 3-6.", 
            "Soft 17 is a weak hand (it only pushes vs 17). Against a weak dealer, double down to put more money on the table, hoping for a 10 (making 17 hard) or A-4 (improving total).", 
            "Example: Player [A, 6] vs Dealer [4]");
        }
        return decision(Action.Hit, "Hit Soft 17 otherwise.", 
        "Soft 17 is essentially a drawing hand. Always try to improve it if you can't double.", 
        "Example: Player [A, 6] vs Dealer [8]");
    }

    // Soft 15/16
    if (total === 15 || total === 16) {
        if (dealerVal >= 4 && dealerVal <= 6) {
            return decision(Action.Double, `Double Soft ${total} against 4-6.`, 
            "The dealer is at their weakest showing 4, 5, or 6. Use the flexibility of your Ace to double your bet.", 
            `Example: Player [A, ${total - 11}] vs Dealer [5]`);
        }
        return decision(Action.Hit, `Hit Soft ${total} otherwise.`, 
        "This soft total is too low to win. You must hit to improve. Since you cannot bust, it's a free chance to upgrade.", 
        `Example: Player [A, ${total - 11}] vs Dealer [2]`);
    }

    // Soft 13/14
    if (total === 13 || total === 14) {
        if (dealerVal >= 5 && dealerVal <= 6) {
            return decision(Action.Double, `Double Soft ${total} against 5-6.`, 
            "Similar to other soft hands, capitalize on the dealer's maximum weakness (5 or 6) by doubling.", 
            `Example: Player [A, ${total - 11}] vs Dealer [6]`);
        }
        return decision(Action.Hit, `Hit Soft ${total} otherwise.`, 
        "You need to improve this total. Hit freely.", 
        `Example: Player [A, ${total - 11}] vs Dealer [8]`);
    }
  }

  // 3. HARD TOTALS
  // Hard 17+
  if (total >= 17) {
      return decision(Action.Stand, "Always stand on Hard 17+.", 
      "The risk of busting is enormous (you need an Ace, 2, 3, or 4). The dealer will bust often enough that standing is the only prudent play.", 
      "Example: Player [10, 7] vs Dealer [A]");
  }
  
  // Hard 13-16
  if (total >= 13) {
    if (dealerVal >= 2 && dealerVal <= 6) {
        return decision(Action.Stand, `Stand on Hard ${total} against dealer 2-6.`, 
        "Dealer is showing a 'bust card'. They have a high probability of busting (drawing to over 21). Don't risk busting yourself; let them do the work.", 
        `Example: Player [10, ${total - 10}] vs Dealer [5]`);
    }
    return decision(Action.Hit, `Hit Hard ${total} against dealer 7+.`, 
    `You are in a bad spot. The dealer likely has 17+. Your only hope is to draw a card to improve, even though you might bust. Standing is effectively surrendering the hand.`, 
    `Example: Player [10, ${total - 10}] vs Dealer [9]`);
  }
  
  // Hard 12
  if (total === 12) {
    if (dealerVal >= 4 && dealerVal <= 6) {
        return decision(Action.Stand, "Stand on Hard 12 against 4-6.", 
        "Dealer is weak. 12 is a dangerous hand to hit (only 4 cards bust you: 10, J, Q, K). Against a weak dealer, play it safe.", 
        "Example: Player [10, 2] vs Dealer [4]");
    }
    return decision(Action.Hit, "Hit Hard 12 against 2, 3 or 7+.", 
    "Dealer 2 and 3 are safer for the dealer than they look. You should hit 12 to try to improve, as the dealer is less likely to bust than with 4-6.", 
    "Example: Player [8, 4] vs Dealer [2]");
  }

  // Hard 11
  if (total === 11) {
      return decision(Action.Double, "Always double Hard 11.", 
      "This is one of the most profitable positions in Blackjack. You are extremely likely to make a 21 or 20. Double down to maximize value.", 
      "Example: Player [6, 5] vs Dealer [6]");
  }

  // Hard 10
  if (total === 10) {
    if (dealerVal <= 9) {
        return decision(Action.Double, "Double Hard 10 against 2-9.", 
        "You have a big advantage. The dealer does not have a 10 or Ace showing, so they are unlikely to beat your probable 20.", 
        "Example: Player [6, 4] vs Dealer [8]");
    }
    return decision(Action.Hit, "Hit Hard 10 against 10 or Ace.", 
    "Dealer is showing strength. If you double and catch a small card, you lose twice as much. Just hit.", 
    "Example: Player [7, 3] vs Dealer [K]");
  }

  // Hard 9
  if (total === 9) {
    if (dealerVal >= 3 && dealerVal <= 6) {
        return decision(Action.Double, "Double Hard 9 against 3-6.", 
        "Dealer is weak. You can double confidently knowing a 10 gives you 19, a strong winning hand.", 
        "Example: Player [5, 4] vs Dealer [5]");
    }
    return decision(Action.Hit, "Hit Hard 9 otherwise.", 
    "Dealer 2 is a bit too safe to double against with 9. Dealer 7+ is too strong. Just hit.", 
    "Example: Player [5, 4] vs Dealer [2]");
  }

  // Hard 8 or less
  return decision(Action.Hit, "Always hit Hard 8 or less.", 
  "You cannot bust. You must take a card to improve your hand.", 
  "Example: Player [3, 4] vs Dealer [5]");
};