import { describe, expect, it } from 'vitest';
import { makeCard } from '../domain/cards.js';
import type { Card, Rank, Suit } from '../domain/cards.js';
import type { Bout } from '../domain/bout.js';
import type { GameState } from '../domain/game.js';
import type { TablePair } from '../domain/table.js';
import { applyAction } from './game.js';
import { timeoutMoves } from './timeout.js';

const c = (suit: Suit, rank: Rank): Card => makeCard(suit, rank);

/** Players a (attacker), b (defender), c; trump is hearts. */
function makeState(
  overrides: Omit<Partial<GameState>, 'bout'> & { bout?: Partial<Bout> } = {},
): GameState {
  const { bout, ...rest } = overrides;
  return {
    version: 0,
    deck: [],
    trumpCard: c('H', 6),
    trumpSuit: 'H',
    hands: {
      a: [c('H', 7), c('S', 9), c('D', 7)],
      b: [c('S', 10), c('C', 12)],
      c: [c('S', 8), c('D', 9)],
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
      ...bout,
    },
    outcome: null,
    ...rest,
  };
}

const uncovered: TablePair[] = [{ attack: c('S', 7), defense: null }];
const covered: TablePair[] = [{ attack: c('S', 7), defense: c('S', 10) }];

describe('timeoutMoves', () => {
  it('makes the main attacker attack with the lowest non-trump card on an empty table', () => {
    const moves = timeoutMoves(makeState());

    expect(moves).toEqual([['a', { type: 'attack', cardId: 'D7' }]]);
  });

  it('attacks with the lowest trump when the hand is all trumps', () => {
    const state = makeState({ hands: { a: [c('H', 12), c('H', 8)], b: [c('S', 10)], c: [] } });

    expect(timeoutMoves(state)).toEqual([['a', { type: 'attack', cardId: 'H8' }]]);
  });

  it('makes the defender take when there are uncovered cards', () => {
    expect(timeoutMoves(makeState({ table: uncovered }))).toEqual([['b', { type: 'take' }]]);
  });

  it('makes the main attacker pass in the primary stage once the table is covered', () => {
    expect(timeoutMoves(makeState({ table: covered }))).toEqual([['a', { type: 'pass' }]]);
  });

  it('makes every attacker who has not passed pass in the open stage', () => {
    const state = makeState({
      table: covered,
      bout: { stage: 'open', passed: ['a'] },
    });

    expect(timeoutMoves(state)).toEqual([['c', { type: 'pass' }]]);
  });

  it('waits on the attackers, not the defender, once the defender is taking', () => {
    const state = makeState({
      table: uncovered,
      bout: { defenderTaking: true, stage: 'open' },
    });

    expect(timeoutMoves(state)).toEqual([
      ['a', { type: 'pass' }],
      ['c', { type: 'pass' }],
    ]);
  });

  it('skips empty-handed attackers', () => {
    const state = makeState({
      table: covered,
      bout: { stage: 'open' },
      hands: { a: [c('D', 7)], b: [c('S', 10)], c: [] },
    });

    expect(timeoutMoves(state)).toEqual([['a', { type: 'pass' }]]);
  });

  it('returns nothing after the game is over', () => {
    expect(timeoutMoves(makeState({ outcome: { type: 'draw' } }))).toEqual([]);
  });

  it('produces moves the engine accepts in every case', () => {
    const states = [
      makeState(),
      makeState({ table: uncovered }),
      makeState({ table: covered }),
      makeState({ table: covered, bout: { stage: 'open', passed: ['a'] } }),
      makeState({ table: uncovered, bout: { defenderTaking: true, stage: 'open' } }),
    ];

    for (const state of states) {
      const [[playerId, action]] = timeoutMoves(state) as [[string, never]];
      expect(applyAction(state, playerId, action).ok).toBe(true);
    }
  });
});
