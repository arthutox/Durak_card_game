/**
 * Card domain for a 36-card Durak deck (ranks 6..Ace).
 * Values are plain, immutable data so they can be sent over the wire as-is.
 */

export const SUITS = ['S', 'H', 'D', 'C'] as const; // ♠ ♥ ♦ ♣
export type Suit = (typeof SUITS)[number];

/** 11 = Jack, 12 = Queen, 13 = King, 14 = Ace. */
export const RANKS = [6, 7, 8, 9, 10, 11, 12, 13, 14] as const;
export type Rank = (typeof RANKS)[number];

/** Stable, human-readable id, unique within one deck: 'H10', 'S14'. */
export type CardId = `${Suit}${Rank}`;

export interface Card {
  readonly id: CardId;
  readonly suit: Suit;
  readonly rank: Rank;
}

export function makeCard(suit: Suit, rank: Rank): Card {
  return { id: `${suit}${rank}`, suit, rank };
}

const CARD_ID_PATTERN = /^([SHDC])(6|7|8|9|10|11|12|13|14)$/;

/** Type guard used when validating untrusted input (e.g. socket payloads). */
export function isCardId(value: string): value is CardId {
  return CARD_ID_PATTERN.test(value);
}

/** 'H10' → { id: 'H10', suit: 'H', rank: 10 }. Throws on malformed ids. */
export function parseCardId(id: string): Card {
  const match = CARD_ID_PATTERN.exec(id);
  if (!match) throw new Error(`Invalid card id: ${id}`);
  return makeCard(match[1] as Suit, Number(match[2]) as Rank);
}
