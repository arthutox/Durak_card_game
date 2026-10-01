import { RANKS, SUITS, makeCard } from '../domain/cards.js';
import type { Card } from '../domain/cards.js';
import { MAX_PLAYERS, MIN_PLAYERS } from '../domain/player.js';
import type { PlayerId } from '../domain/player.js';
import { HAND_SIZE } from './constants.js';
import { randomInt } from './rng.js';
import type { Rng } from './rng.js';

/** A fresh, ordered 36-card deck. */
export function createDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => makeCard(suit, rank)));
}

/**
 * Fisher–Yates shuffle. Pure: returns a new array and never mutates the input.
 */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export interface DealResult {
  readonly hands: Readonly<Record<PlayerId, readonly Card[]>>;
  /**
   * Remaining stock. Convention: the top of the stock is the END of the array
   * (cards are drawn with pop), so `stock[0]` is the bottom card — the face-up
   * trump that is drawn last.
   */
  readonly stock: readonly Card[];
  /** The face-up trump card. */
  readonly trumpCard: Card;
}

/**
 * Deals HAND_SIZE cards to each player one at a time, clockwise, from the top
 * of an already shuffled deck, then reveals the trump.
 *
 * Trump: the bottom card of the remaining stock. With 6 players the whole deck
 * is dealt, so the last dealt card is revealed instead and stays in that
 * player's hand.
 */
export function deal(shuffledDeck: readonly Card[], playerIds: readonly PlayerId[]): DealResult {
  if (playerIds.length < MIN_PLAYERS || playerIds.length > MAX_PLAYERS) {
    throw new RangeError(
      `Durak needs ${MIN_PLAYERS}-${MAX_PLAYERS} players, got ${playerIds.length}`,
    );
  }
  if (new Set(playerIds).size !== playerIds.length) {
    throw new Error('Player ids must be unique');
  }
  if (shuffledDeck.length < playerIds.length * HAND_SIZE) {
    throw new RangeError('Not enough cards to deal');
  }

  const stock = [...shuffledDeck];
  const hands: Record<PlayerId, Card[]> = Object.fromEntries(playerIds.map((id) => [id, []]));
  let lastDealt: Card | undefined;

  for (let round = 0; round < HAND_SIZE; round++) {
    for (const id of playerIds) {
      lastDealt = stock.pop()!;
      hands[id]!.push(lastDealt);
    }
  }

  const trumpCard = stock[0] ?? lastDealt!;
  return { hands, stock, trumpCard };
}
