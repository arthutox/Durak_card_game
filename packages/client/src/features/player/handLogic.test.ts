import { describe, expect, it } from 'vitest';
import { makeCard } from '@durak/shared';
import type { Card, PlayerView, TablePair } from '@durak/shared';
import { attackableCardIds, canPass, canTake, defendTargets, myRole } from './handLogic';

const c = makeCard;

function view(
  meId: string,
  overrides: { hand?: Card[]; table?: TablePair[]; bout?: Partial<PlayerView['bout']> } = {},
): PlayerView {
  return {
    version: 1,
    players: ['a', 'b', 'c'].map((id) => ({
      id,
      nickname: id.toUpperCase(),
      color: 'red' as const,
      cardCount: 6,
      online: true,
      finished: false,
    })),
    trumpCard: c('H', 6),
    trumpSuit: 'H',
    deckCount: 10,
    table: overrides.table ?? [],
    discardCount: 0,
    bout: {
      attackerId: 'a',
      defenderId: 'b',
      stage: 'primary',
      defenderTaking: false,
      passed: [],
      limit: 6,
      ...overrides.bout,
    },
    isFirstBout: false,
    outcome: null,
    me: { id: meId, hand: overrides.hand ?? [c('S', 7), c('D', 7), c('C', 9)] },
  };
}

const open = { attack: c('S', 7), defense: null };

describe('myRole', () => {
  it('attacker, defender, and idle until the bout opens up', () => {
    expect(myRole(view('a'))).toBe('attacker');
    expect(myRole(view('b'))).toBe('defender');
    expect(myRole(view('c'))).toBe('idle');
    expect(myRole(view('c', { bout: { stage: 'open' } }))).toBe('thrower');
  });
});

describe('attacking', () => {
  it('the attacker may open with any card', () => {
    expect([...attackableCardIds(view('a'))]).toEqual(['S7', 'D7', 'C9']);
  });

  it('a follow-up card must match a rank on the table', () => {
    expect([...attackableCardIds(view('a', { table: [open] }))]).toEqual(['S7', 'D7']);
  });

  it('an idle player or the defender cannot attack', () => {
    expect(attackableCardIds(view('c')).size).toBe(0);
    expect(attackableCardIds(view('b')).size).toBe(0);
  });

  it('nothing is attackable once the table is full', () => {
    expect(attackableCardIds(view('a', { table: [open], bout: { limit: 1 } })).size).toBe(0);
  });
});

describe('defending', () => {
  const hand = [c('S', 10), c('D', 8), c('H', 7)];

  it('targets are the uncovered attacks the card beats', () => {
    const table = [open, { attack: c('D', 9), defense: null }];
    const v = view('b', { hand, table });

    expect(defendTargets(v, c('S', 10))).toEqual([0]);
    expect(defendTargets(v, c('H', 7))).toEqual([0, 1]);
    expect(defendTargets(v, c('D', 8))).toEqual([]);
  });

  it('no targets for a non-defender or after pressing take', () => {
    expect(defendTargets(view('a', { table: [open] }), c('S', 10))).toEqual([]);
    expect(
      defendTargets(view('b', { table: [open], bout: { defenderTaking: true } }), c('S', 10)),
    ).toEqual([]);
  });
});

describe('buttons', () => {
  it('Take: only the defender, only with something uncovered', () => {
    expect(canTake(view('b', { table: [open] }))).toBe(true);
    expect(canTake(view('b'))).toBe(false);
    expect(canTake(view('b', { table: [{ ...open, defense: c('S', 9) }] }))).toBe(false);
    expect(canTake(view('a', { table: [open] }))).toBe(false);
  });

  it('Pass: attackers with a non-empty table who have not passed yet', () => {
    expect(canPass(view('a'))).toBe(false);
    expect(canPass(view('a', { table: [open] }))).toBe(true);
    expect(canPass(view('a', { table: [open], bout: { passed: ['a'] } }))).toBe(false);
    expect(canPass(view('c', { table: [open] }))).toBe(false);
    expect(canPass(view('c', { table: [open], bout: { stage: 'open' } }))).toBe(true);
    expect(canPass(view('b', { table: [open] }))).toBe(false);
  });
});
