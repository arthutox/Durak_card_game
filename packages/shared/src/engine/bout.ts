/**
 * Bout state machine: one attack-and-defense exchange between the main
 * attacker(s) and the defender. Pure: takes a state, returns a new one.
 *
 * Drawing, turn passing and the end of the game are handled one level up
 * (`draw.ts`, `game.ts`); this module only reports how the bout was resolved.
 */
import type { Bout } from '../domain/bout.js';
import type { Card, CardId, Suit } from '../domain/cards.js';
import type { PlayerId } from '../domain/player.js';
import type { TablePair } from '../domain/table.js';
import { err, ok } from '../lib/result.js';
import type { Result } from '../lib/result.js';
import type { ErrorCode } from '../protocol/errors.js';
import { canBeat, canThrowIn, isTableCovered, remainingSlots } from './rules.js';

export type BoutAction =
  | { readonly type: 'attack'; readonly cardId: CardId }
  | { readonly type: 'defend'; readonly cardId: CardId; readonly targetAttackIndex: number }
  | { readonly type: 'pass' }
  | { readonly type: 'take' };

/** The slice of the game state a bout reads and changes. */
export interface BoutState {
  readonly trumpSuit: Suit;
  /** Seats, clockwise. */
  readonly order: readonly PlayerId[];
  readonly hands: Readonly<Record<PlayerId, readonly Card[]>>;
  readonly table: readonly TablePair[];
  readonly bout: Bout;
}

/** How the bout ended; `null` while it is still going on. */
export type BoutResolution = 'beaten' | 'taken' | null;

export interface BoutStep {
  readonly state: BoutState;
  readonly resolution: BoutResolution;
}

export function applyBoutAction(
  state: BoutState,
  playerId: PlayerId,
  action: BoutAction,
): Result<BoutStep, ErrorCode> {
  if (!isConsistent(state)) return err('ILLEGAL_ACTION');
  const result = dispatch(state, playerId, action);
  return result.ok ? ok(settle(result.value.state)) : result;
}

/** Guards against a corrupted state: both bout roles must be seated. */
function isConsistent({ order, bout }: BoutState): boolean {
  return (
    bout.attackerId !== bout.defenderId &&
    order.includes(bout.attackerId) &&
    order.includes(bout.defenderId)
  );
}

function dispatch(
  state: BoutState,
  playerId: PlayerId,
  action: BoutAction,
): Result<BoutStep, ErrorCode> {
  switch (action.type) {
    case 'attack':
      return attack(state, playerId, action.cardId);
    case 'defend':
      return defend(state, playerId, action.cardId, action.targetAttackIndex);
    case 'pass':
      return pass(state, playerId);
    case 'take':
      return take(state, playerId);
    default:
      // Unreachable for validated input; guards against an unvalidated payload at runtime.
      return err('ILLEGAL_ACTION');
  }
}

/** Who may put attack cards on the table right now (priority, not card rules). */
export function mayAttack(state: BoutState, playerId: PlayerId): boolean {
  const { bout } = state;
  if (playerId === bout.defenderId || !state.order.includes(playerId)) return false;
  return bout.stage === 'open' || playerId === bout.attackerId;
}

function attack(state: BoutState, playerId: PlayerId, cardId: CardId): Result<BoutStep, ErrorCode> {
  if (!mayAttack(state, playerId)) return err('NOT_YOUR_TURN');

  const hand = state.hands[playerId] ?? [];
  const card = hand.find((candidate) => candidate.id === cardId);
  if (!card) return err('CARD_NOT_IN_HAND');
  if (remainingSlots(state.table, state.bout.limit) === 0) return err('TABLE_LIMIT');
  if (!canThrowIn(card, state.table, state.bout.limit)) return err('RANK_NOT_ON_TABLE');

  return ok({
    state: {
      ...state,
      hands: { ...state.hands, [playerId]: hand.filter((candidate) => candidate !== card) },
      table: [...state.table, { attack: card, defense: null }],
      bout: { ...state.bout, passed: [] },
    },
    resolution: null,
  });
}

function defend(
  state: BoutState,
  playerId: PlayerId,
  cardId: CardId,
  targetAttackIndex: number,
): Result<BoutStep, ErrorCode> {
  if (playerId !== state.bout.defenderId) return err('NOT_YOUR_TURN');
  if (state.bout.defenderTaking) return err('ILLEGAL_ACTION');

  const hand = state.hands[playerId] ?? [];
  const card = hand.find((candidate) => candidate.id === cardId);
  if (!card) return err('CARD_NOT_IN_HAND');

  const target = state.table[targetAttackIndex];
  if (!target || target.defense !== null) return err('INVALID_TARGET');
  if (!canBeat(target.attack, card, state.trumpSuit)) return err('CANNOT_BEAT');

  return ok({
    state: {
      ...state,
      hands: { ...state.hands, [playerId]: hand.filter((candidate) => candidate !== card) },
      table: state.table.map((pair, index) =>
        index === targetAttackIndex ? { ...pair, defense: card } : pair,
      ),
    },
    resolution: null,
  });
}

function pass(state: BoutState, playerId: PlayerId): Result<BoutStep, ErrorCode> {
  const { bout } = state;
  if (!mayAttack(state, playerId)) return err('NOT_YOUR_TURN');
  if (state.table.length === 0) return err('ILLEGAL_ACTION');
  // Out of cards means out of the bout: such a player counts as passed already.
  if ((state.hands[playerId] ?? []).length === 0) return err('ILLEGAL_ACTION');

  const passed = bout.passed.includes(playerId) ? bout.passed : [...bout.passed, playerId];

  return ok({
    state: {
      ...state,
      bout: { ...bout, passed, stage: playerId === bout.attackerId ? 'open' : bout.stage },
    },
    resolution: null,
  });
}

function take(state: BoutState, playerId: PlayerId): Result<BoutStep, ErrorCode> {
  if (playerId !== state.bout.defenderId) return err('NOT_YOUR_TURN');
  if (state.bout.defenderTaking || state.table.every((pair) => pair.defense !== null)) {
    return err('ILLEGAL_ACTION');
  }

  return ok({
    state: { ...state, bout: { ...state.bout, defenderTaking: true } },
    resolution: null,
  });
}

/** An attacker is done once they passed or have nothing left to throw in. */
function isDone(state: BoutState, playerId: PlayerId): boolean {
  return state.bout.passed.includes(playerId) || (state.hands[playerId] ?? []).length === 0;
}

/**
 * Normalizes the bout after an action and decides whether it is over:
 * - an empty-handed main attacker can no longer attack, so priority opens up;
 * - everyone done (open stage) or the table full ends the bout: "taken" if the
 *   defender is taking, "beaten" if everything is covered. An uncovered table
 *   with no take declared waits for the defender.
 */
function settle(input: BoutState): BoutStep {
  const mainAttackerOut = (input.hands[input.bout.attackerId] ?? []).length === 0;
  const state: BoutState =
    input.bout.stage === 'primary' && mainAttackerOut && input.table.length > 0
      ? { ...input, bout: { ...input.bout, stage: 'open' } }
      : input;
  const { bout, table } = state;

  const everyAttackerDone = state.order
    .filter((id) => id !== bout.defenderId)
    .every((id) => isDone(state, id));
  const finished =
    (bout.stage === 'open' && everyAttackerDone) || remainingSlots(table, bout.limit) === 0;

  if (!finished) return { state, resolution: null };
  if (bout.defenderTaking) return { state, resolution: 'taken' };
  return { state, resolution: isTableCovered(table) ? 'beaten' : null };
}
