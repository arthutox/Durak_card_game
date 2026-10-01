/**
 * Refilling hands from the stock after a bout.
 * Pure: takes hands and stock, returns new ones.
 */
import type { Card } from '../domain/cards.js';
import type { PlayerId } from '../domain/player.js';
import { HAND_SIZE } from './constants.js';

export interface RefillParams {
  /** Seats, clockwise. */
  readonly order: readonly PlayerId[];
  readonly hands: Readonly<Record<PlayerId, readonly Card[]>>;
  /** Top of the stock is the END of the array (see `deal`). */
  readonly stock: readonly Card[];
  readonly attackerId: PlayerId;
  readonly defenderId: PlayerId;
}

export interface RefillResult {
  readonly hands: Readonly<Record<PlayerId, readonly Card[]>>;
  readonly stock: readonly Card[];
}

/**
 * Everyone draws up to HAND_SIZE while the stock lasts, in this order:
 * main attacker, the other attackers clockwise, the defender last.
 */
export function refillHands(params: RefillParams): RefillResult {
  const { order, attackerId, defenderId } = params;
  const start = order.indexOf(attackerId);
  const clockwise = order.map((_, step) => order[(start + step) % order.length]!);
  const drawOrder = [...clockwise.filter((id) => id !== defenderId), defenderId];

  const stock = [...params.stock];
  const hands: Record<PlayerId, readonly Card[]> = { ...params.hands };
  for (const id of drawOrder) {
    const hand = [...(hands[id] ?? [])];
    while (hand.length < HAND_SIZE && stock.length > 0) hand.push(stock.pop()!);
    hands[id] = hand;
  }
  return { hands, stock };
}
