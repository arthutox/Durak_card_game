import type { Card, Suit } from '../domain/cards.js';
import type { PlayerId } from '../domain/player.js';
import { randomInt } from './rng.js';
import type { Rng } from './rng.js';

/**
 * Next player clockwise after `fromId` that satisfies `isActive`
 * (e.g. still has cards). `fromId` itself is checked last, after a full lap.
 * Returns null when nobody is active.
 */
export function nextActive(
  order: readonly PlayerId[],
  fromId: PlayerId,
  isActive: (id: PlayerId) => boolean,
): PlayerId | null {
  const start = order.indexOf(fromId);
  if (start === -1) throw new Error(`Unknown player: ${fromId}`);

  for (let step = 1; step <= order.length; step++) {
    const candidate = order[(start + step) % order.length]!;
    if (isActive(candidate)) return candidate;
  }
  return null;
}

/**
 * Who opens the game: the holder of the lowest trump.
 * If nobody holds a trump, a random player starts.
 */
export function firstAttacker(
  order: readonly PlayerId[],
  hands: Readonly<Record<PlayerId, readonly Card[]>>,
  trumpSuit: Suit,
  rng: Rng,
): PlayerId {
  if (order.length === 0) throw new Error('No players');

  let best: { playerId: PlayerId; rank: number } | null = null;
  for (const playerId of order) {
    for (const card of hands[playerId] ?? []) {
      if (card.suit === trumpSuit && (best === null || card.rank < best.rank)) {
        best = { playerId, rank: card.rank };
      }
    }
  }
  return best?.playerId ?? order[randomInt(rng, order.length)]!;
}
