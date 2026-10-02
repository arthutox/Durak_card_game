import type { Card, Rank, Suit } from '@durak/shared';

export const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

const RANK_LABEL: Partial<Record<Rank, string>> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export function rankLabel(rank: Rank): string {
  return RANK_LABEL[rank] ?? String(rank);
}

/** 'H10' → '10♥'. */
export function cardLabel(card: Card): string {
  return `${rankLabel(card.rank)}${SUIT_SYMBOL[card.suit]}`;
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 'H' || suit === 'D';
}
