/**
 * Default moves for the turn timer: what the server plays for whoever is
 * holding the game up. Pure, built only from moves the engine already accepts.
 */
import type { Card } from '../domain/cards.js';
import type { GameState } from '../domain/game.js';
import type { PlayerId } from '../domain/player.js';
import { mayAttack } from './bout.js';
import type { Action } from './game.js';

/**
 * The moves to play when the clock runs out, in the order to apply them.
 * Empty when nobody is holding the game up (game over).
 *
 * - empty table: the main attacker attacks with their lowest card (`pass` is illegal here);
 * - the defender has uncovered cards to answer: the defender takes;
 * - otherwise every attacker who may still throw in passes. Applying these one by one
 *   can end the bout early, so the caller stops at the first rejected move.
 */
export function timeoutMoves(state: GameState): [PlayerId, Action][] {
  if (state.outcome !== null) return [];
  const { bout, table } = state;

  if (table.length === 0) {
    const card = lowestCard(state.hands[bout.attackerId] ?? [], state.trumpSuit);
    return card ? [[bout.attackerId, { type: 'attack', cardId: card.id }]] : [];
  }

  const hasUncovered = table.some((pair) => pair.defense === null);
  if (hasUncovered && !bout.defenderTaking) return [[bout.defenderId, { type: 'take' }]];

  return state.order
    .filter(
      (id) =>
        mayAttack(state, id) && !bout.passed.includes(id) && (state.hands[id] ?? []).length > 0,
    )
    .map((id): [PlayerId, Action] => [id, { type: 'pass' }]);
}

/** Lowest card, trumps counting as higher than any plain card. */
function lowestCard(hand: readonly Card[], trumpSuit: Card['suit']): Card | undefined {
  const strength = (card: Card): number => card.rank + (card.suit === trumpSuit ? 100 : 0);
  return hand.reduce<Card | undefined>(
    (lowest, card) => (!lowest || strength(card) < strength(lowest) ? card : lowest),
    undefined,
  );
}
