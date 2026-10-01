/**
 * Pure rule primitives of Podkidnoy Durak.
 *
 * Shared by the server (authoritative validation of every move) and the
 * client (highlighting valid drop targets while dragging). No I/O, no state.
 */
import type { Card, Rank, Suit } from '../domain/cards.js';
import type { TablePair } from '../domain/table.js';
import { BOUT_ATTACK_LIMIT, FIRST_BOUT_ATTACK_LIMIT } from './constants.js';

/**
 * Can `defense` beat `attack`?
 * - same suit and higher rank, or
 * - defense is a trump and attack is not.
 */
export function canBeat(attack: Card, defense: Card, trumpSuit: Suit): boolean {
  if (attack.suit === defense.suit) {
    return defense.rank > attack.rank;
  }
  return defense.suit === trumpSuit;
}

/**
 * Max number of attack cards for a bout, fixed when the bout starts:
 * min(5 in the first bout / 6 otherwise, defender's hand size at bout start).
 */
export function tableLimit(params: { defenderHandSize: number; isFirstBout: boolean }): number {
  const cap = params.isFirstBout ? FIRST_BOUT_ATTACK_LIMIT : BOUT_ATTACK_LIMIT;
  return Math.max(0, Math.min(cap, params.defenderHandSize));
}

/** How many more attack cards may still be put on the table. */
export function remainingSlots(table: readonly TablePair[], limit: number): number {
  return Math.max(0, limit - table.length);
}

/** Every rank currently on the table, attack and defense cards alike. */
export function ranksOnTable(table: readonly TablePair[]): ReadonlySet<Rank> {
  const ranks = new Set<Rank>();
  for (const { attack, defense } of table) {
    ranks.add(attack.rank);
    if (defense) ranks.add(defense.rank);
  }
  return ranks;
}

/**
 * Can `card` be played as an attack card right now?
 * The opening card of a bout may be anything; every following card must match
 * a rank already on the table. Never above the bout limit.
 *
 * Turn order / priority (who may attack) is a separate concern handled by the
 * bout state machine, not here.
 */
export function canThrowIn(card: Card, table: readonly TablePair[], limit: number): boolean {
  if (remainingSlots(table, limit) === 0) return false;
  if (table.length === 0) return true;
  return ranksOnTable(table).has(card.rank);
}

/** Indexes of uncovered attack cards that `card` can beat. */
export function validDefenseTargets(
  card: Card,
  table: readonly TablePair[],
  trumpSuit: Suit,
): number[] {
  const targets: number[] = [];
  table.forEach((pair, index) => {
    if (pair.defense === null && canBeat(pair.attack, card, trumpSuit)) {
      targets.push(index);
    }
  });
  return targets;
}

/** True when there is at least one attack and every attack is covered. */
export function isTableCovered(table: readonly TablePair[]): boolean {
  return table.length > 0 && table.every((pair) => pair.defense !== null);
}
