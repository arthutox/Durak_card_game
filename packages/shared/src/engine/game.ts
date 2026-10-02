/**
 * Game facade: `createGame` and `applyAction`. Delegates a single bout to
 * `bout.ts`, and after a bout ends does the drawing, the turn passing and the
 * end-of-game check. Pure: every call returns a new state.
 */
import type { GameEvent, GameOutcome, GameState } from '../domain/game.js';
import type { Card } from '../domain/cards.js';
import type { PlayerId } from '../domain/player.js';
import { err, ok } from '../lib/result.js';
import type { Result } from '../lib/result.js';
import type { ErrorCode } from '../protocol/errors.js';
import { applyBoutAction } from './bout.js';
import type { BoutAction, BoutResolution } from './bout.js';
import { createDeck, deal, shuffle } from './deck.js';
import { refillHands } from './draw.js';
import type { Rng } from './rng.js';
import { tableLimit } from './rules.js';
import { firstAttacker, nextActive } from './turnOrder.js';

export type Action = BoutAction;

export interface ActionResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

export function createGame(playerIds: readonly PlayerId[], rng: Rng): GameState {
  const { hands, stock, trumpCard } = deal(shuffle(createDeck(), rng), playerIds);
  const order = [...playerIds];
  const attackerId = firstAttacker(order, hands, trumpCard.suit, rng);
  const defenderId = nextActive(order, attackerId, () => true)!;

  return {
    version: 0,
    deck: stock,
    trumpCard,
    trumpSuit: trumpCard.suit,
    hands,
    order,
    finished: [],
    table: [],
    discard: [],
    isFirstBout: true,
    bout: {
      attackerId,
      defenderId,
      stage: 'primary',
      defenderTaking: false,
      passed: [],
      limit: tableLimit({ defenderHandSize: hands[defenderId]!.length, isFirstBout: true }),
    },
    outcome: null,
  };
}

export function applyAction(
  state: GameState,
  playerId: PlayerId,
  action: Action,
): Result<ActionResult, ErrorCode> {
  if (state.outcome !== null) return err('ILLEGAL_ACTION');

  const step = applyBoutAction(state, playerId, action);
  if (!step.ok) return step;

  const events: GameEvent[] = [actionEvent(state, playerId, action)];
  const next: GameState = { ...state, ...step.value.state, version: state.version + 1 };
  if (step.value.resolution === null) return ok({ state: next, events });

  return ok({ state: finishBout(next, step.value.resolution, events), events });
}

function actionEvent(state: GameState, playerId: PlayerId, action: Action): GameEvent {
  switch (action.type) {
    case 'attack':
      return { type: 'attack', playerId, card: findCard(state.hands[playerId], action.cardId) };
    case 'defend':
      return {
        type: 'defend',
        playerId,
        card: findCard(state.hands[playerId], action.cardId),
        targetAttackIndex: action.targetAttackIndex,
      };
    case 'pass':
      return { type: 'pass', playerId };
    case 'take':
      return { type: 'take', playerId };
  }
}

/** Only called for actions the bout already accepted, so the card is always there. */
function findCard(hand: readonly Card[] | undefined, cardId: string): Card {
  return hand!.find((card) => card.id === cardId)!;
}

/** Clears the table, refills hands, retires players, then sets up the next bout or ends the game. */
function finishBout(
  state: GameState,
  resolution: Exclude<BoutResolution, null>,
  events: GameEvent[],
): GameState {
  const { attackerId, defenderId } = state.bout;
  const tableCards = state.table.flatMap(({ attack, defense }) =>
    defense ? [attack, defense] : [attack],
  );

  let hands = state.hands;
  let discard = state.discard;
  if (resolution === 'taken') {
    hands = { ...hands, [defenderId]: [...(hands[defenderId] ?? []), ...tableCards] };
    events.push({ type: 'bout_taken', defenderId, count: tableCards.length });
  } else {
    discard = [...discard, ...tableCards];
    events.push({ type: 'bout_beaten', defenderId });
  }

  const refilled = refillHands({
    order: state.order,
    hands,
    stock: state.deck,
    attackerId,
    defenderId,
  });

  const finished = retirePlayers(state, refilled.hands, refilled.stock.length, events);
  const base = {
    ...state,
    hands: refilled.hands,
    deck: refilled.stock,
    discard,
    table: [],
    finished,
  };

  const isActive = (id: PlayerId): boolean => !finished.includes(id);
  const remaining = state.order.filter(isActive);
  if (remaining.length <= 1) {
    const outcome: GameOutcome =
      remaining.length === 1 ? { type: 'loser', playerId: remaining[0]! } : { type: 'draw' };
    events.push({ type: 'game_over', outcome });
    return { ...base, outcome };
  }

  // Beaten: the defender attacks next. Taken: the player after the defender does.
  const nextAttacker =
    resolution === 'beaten' && isActive(defenderId)
      ? defenderId
      : nextActive(state.order, defenderId, isActive)!;
  const nextDefender = nextActive(state.order, nextAttacker, isActive)!;

  return {
    ...base,
    isFirstBout: false,
    bout: {
      attackerId: nextAttacker,
      defenderId: nextDefender,
      stage: 'primary',
      defenderTaking: false,
      passed: [],
      limit: tableLimit({
        defenderHandSize: refilled.hands[nextDefender]!.length,
        isFirstBout: false,
      }),
    },
  };
}

/** With the stock empty, everyone without cards is out. Returns the updated `finished` list. */
function retirePlayers(
  state: GameState,
  hands: GameState['hands'],
  stockSize: number,
  events: GameEvent[],
): readonly PlayerId[] {
  if (stockSize > 0) return state.finished;

  const finished = [...state.finished];
  const start = state.order.indexOf(state.bout.attackerId);
  for (let step = 0; step < state.order.length; step++) {
    const id = state.order[(start + step) % state.order.length]!;
    if (!finished.includes(id) && (hands[id] ?? []).length === 0) {
      finished.push(id);
      events.push({ type: 'player_finished', playerId: id });
    }
  }
  return finished;
}
