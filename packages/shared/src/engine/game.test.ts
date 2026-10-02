import { describe, expect, it } from 'vitest';
import { makeCard } from '../domain/cards.js';
import type { Card, Rank, Suit } from '../domain/cards.js';
import type { GameState } from '../domain/game.js';
import type { PlayerId } from '../domain/player.js';
import { applyAction, createGame } from './game.js';
import type { Action } from './game.js';
import { createSeededRng } from './rng.js';

const c = (suit: Suit, rank: Rank): Card => makeCard(suit, rank);

/** Three players a (attacker), b (defender), c; trump is hearts; stock is configurable. */
function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    version: 0,
    deck: [],
    trumpCard: c('H', 6),
    trumpSuit: 'H',
    hands: {
      a: [c('S', 7), c('D', 7)],
      b: [c('S', 10), c('C', 12)],
      c: [c('S', 9), c('D', 9)],
    },
    order: ['a', 'b', 'c'],
    finished: [],
    table: [],
    discard: [],
    isFirstBout: false,
    bout: {
      attackerId: 'a',
      defenderId: 'b',
      stage: 'primary',
      defenderTaking: false,
      passed: [],
      limit: 6,
    },
    outcome: null,
    ...overrides,
  };
}

function play(state: GameState, moves: readonly [PlayerId, Action][]): GameState {
  return moves.reduce((current, [playerId, action]) => {
    const result = applyAction(current, playerId, action);
    if (!result.ok) throw new Error(`${playerId} ${JSON.stringify(action)}: ${result.error}`);
    return result.value.state;
  }, state);
}

describe('createGame', () => {
  it('deals 6 cards each, reveals the trump and picks a defender next to the attacker', () => {
    const state = createGame(['a', 'b', 'c'], createSeededRng(1));

    expect(Object.values(state.hands).every((hand) => hand.length === 6)).toBe(true);
    expect(state.deck).toHaveLength(36 - 18);
    expect(state.trumpSuit).toBe(state.trumpCard.suit);
    expect(state.isFirstBout).toBe(true);
    expect(state.bout.limit).toBe(5);
    const attackerSeat = state.order.indexOf(state.bout.attackerId);
    expect(state.bout.defenderId).toBe(state.order[(attackerSeat + 1) % 3]);
  });
});

describe('applyAction', () => {
  it('increments the version and reports an event', () => {
    const result = applyAction(makeState(), 'a', { type: 'attack', cardId: 'S7' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.version).toBe(1);
    expect(result.value.events).toEqual([{ type: 'attack', playerId: 'a', card: c('S', 7) }]);
  });

  it('beaten: the table goes to the discard, the defender attacks next', () => {
    const state = play(makeState({ deck: [c('D', 6), c('D', 8), c('D', 10), c('D', 11)] }), [
      ['a', { type: 'attack', cardId: 'S7' }],
      ['b', { type: 'defend', cardId: 'S10', targetAttackIndex: 0 }],
      ['a', { type: 'pass' }],
      ['c', { type: 'pass' }],
    ]);

    expect(state.discard).toEqual([c('S', 7), c('S', 10)]);
    expect(state.table).toEqual([]);
    expect(state.bout.attackerId).toBe('b');
    expect(state.bout.defenderId).toBe('c');
    expect(state.isFirstBout).toBe(false);
  });

  it('taken: the defender picks up the table and the next player attacks', () => {
    const state = play(makeState(), [
      ['a', { type: 'attack', cardId: 'S7' }],
      ['b', { type: 'take' }],
      ['a', { type: 'pass' }],
      ['c', { type: 'pass' }],
    ]);

    expect(state.hands['b']).toEqual([c('S', 10), c('C', 12), c('S', 7)]);
    expect(state.bout.attackerId).toBe('c');
    expect(state.bout.defenderId).toBe('a');
  });

  it('draws in order: attacker, other attackers, defender last', () => {
    const state = play(
      makeState({
        hands: { a: [c('S', 7)], b: [c('S', 10)], c: [c('S', 9)] },
        deck: [c('D', 6), c('D', 8), c('D', 10), c('D', 11), c('D', 12), c('D', 13), c('D', 14)],
      }),
      [
        ['a', { type: 'attack', cardId: 'S7' }],
        ['b', { type: 'defend', cardId: 'S10', targetAttackIndex: 0 }],
        ['c', { type: 'pass' }],
      ],
    );

    expect(state.hands['a']).toEqual([
      c('D', 14),
      c('D', 13),
      c('D', 12),
      c('D', 11),
      c('D', 10),
      c('D', 8),
    ]);
    expect(state.hands['c']).toEqual([c('S', 9), c('D', 6)]);
    expect(state.hands['b']).toEqual([]);
    expect(state.deck).toEqual([]);
  });

  it('a player who runs out with an empty stock leaves the game', () => {
    const state = play(
      makeState({ hands: { a: [c('S', 7)], b: [c('S', 10)], c: [c('S', 9), c('D', 9)] } }),
      [
        ['a', { type: 'attack', cardId: 'S7' }],
        ['b', { type: 'defend', cardId: 'S10', targetAttackIndex: 0 }],
        ['c', { type: 'pass' }],
      ],
    );

    expect(state.finished).toEqual(['a', 'b']);
    expect(state.outcome).toEqual({ type: 'loser', playerId: 'c' });
  });

  it('the last two players emptying their hands at once is a draw', () => {
    const state = play(
      makeState({
        hands: { a: [c('S', 7)], b: [c('S', 10)], c: [] },
        finished: ['c'],
      }),
      [
        ['a', { type: 'attack', cardId: 'S7' }],
        ['b', { type: 'defend', cardId: 'S10', targetAttackIndex: 0 }],
      ],
    );

    expect(state.outcome).toEqual({ type: 'draw' });
  });

  it('skips finished players when passing the turn', () => {
    const state = play(
      makeState({
        hands: { a: [c('S', 7), c('D', 7)], b: [c('S', 10), c('C', 12)], c: [] },
        finished: ['c'],
      }),
      [
        ['a', { type: 'attack', cardId: 'S7' }],
        ['b', { type: 'defend', cardId: 'S10', targetAttackIndex: 0 }],
        ['a', { type: 'pass' }],
      ],
    );

    expect(state.bout.attackerId).toBe('b');
    expect(state.bout.defenderId).toBe('a');
  });

  it('rejects actions after the game is over', () => {
    const over = makeState({ outcome: { type: 'draw' } });

    expect(applyAction(over, 'a', { type: 'pass' })).toEqual({
      ok: false,
      error: 'ILLEGAL_ACTION',
    });
  });
});

describe('random legal games', () => {
  function legalActions(state: GameState): [PlayerId, Action][] {
    const candidates: [PlayerId, Action][] = [];
    for (const id of state.order) {
      candidates.push([id, { type: 'pass' }], [id, { type: 'take' }]);
      for (const card of state.hands[id] ?? []) {
        candidates.push([id, { type: 'attack', cardId: card.id }]);
        state.table.forEach((_, index) =>
          candidates.push([id, { type: 'defend', cardId: card.id, targetAttackIndex: index }]),
        );
      }
    }
    return candidates.filter(([id, action]) => applyAction(state, id, action).ok);
  }

  function allCards(state: GameState): string[] {
    return [
      ...Object.values(state.hands).flat(),
      ...state.deck,
      ...state.discard,
      ...state.table.flatMap((pair) =>
        pair.defense ? [pair.attack, pair.defense] : [pair.attack],
      ),
    ]
      .map((card) => card.id)
      .sort();
  }

  it.each([2, 3, 4, 5, 6])('%i players: 36 cards always, and every game terminates', (players) => {
    const ids = Array.from({ length: players }, (_, i) => `p${i}`);
    for (let seed = 1; seed <= 40; seed++) {
      const rng = createSeededRng(seed * 31 + players);
      let state = createGame(ids, rng);
      const expected = allCards(state);
      expect(new Set(expected).size).toBe(36);

      let steps = 0;
      while (state.outcome === null) {
        const moves = legalActions(state);
        expect(moves.length, `seed ${seed}: no legal move`).toBeGreaterThan(0);
        const [id, action] = moves[Math.floor(rng() * moves.length)]!;
        const result = applyAction(state, id, action);
        if (!result.ok) throw new Error('legal move rejected');
        state = result.value.state;
        expect(allCards(state)).toEqual(expected);
        expect(++steps, `seed ${seed}: did not terminate`).toBeLessThan(5000);
      }
    }
  });
});
