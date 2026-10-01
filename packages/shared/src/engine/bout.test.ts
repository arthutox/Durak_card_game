import { describe, expect, it } from 'vitest';
import { makeCard } from '../domain/cards.js';
import type { Card, CardId, Rank, Suit } from '../domain/cards.js';
import type { PlayerId } from '../domain/player.js';
import type { TablePair } from '../domain/table.js';
import { applyBoutAction } from './bout.js';
import type { BoutState } from './bout.js';

const c = (suit: Suit, rank: Rank): Card => makeCard(suit, rank);

/** Three players a (main attacker), b (defender), c; trump is hearts. */
function makeState(overrides: {
  hands?: Record<PlayerId, Card[]>;
  table?: TablePair[];
  bout?: Partial<BoutState['bout']>;
}): BoutState {
  return {
    trumpSuit: 'H',
    order: ['a', 'b', 'c'],
    hands: overrides.hands ?? {
      a: [c('S', 7), c('D', 7), c('C', 9)],
      b: [c('S', 10), c('H', 6), c('D', 8), c('C', 12), c('D', 13), c('C', 14)],
      c: [c('S', 9), c('D', 9), c('C', 6)],
    },
    table: overrides.table ?? [],
    bout: {
      attackerId: 'a',
      defenderId: 'b',
      stage: 'primary',
      defenderTaking: false,
      passed: [],
      limit: 6,
      ...overrides.bout,
    },
  };
}

describe('applyBoutAction: attack', () => {
  it('the main attacker opens the bout: the card moves from the hand to the table', () => {
    const result = applyBoutAction(makeState({}), 'a', { type: 'attack', cardId: 'S7' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.table).toEqual([{ attack: c('S', 7), defense: null }]);
    expect(result.value.state.hands['a']).toEqual([c('D', 7), c('C', 9)]);
    expect(result.value.resolution).toBeNull();
  });

  it('in the primary stage only the main attacker may attack', () => {
    const result = applyBoutAction(makeState({}), 'c', { type: 'attack', cardId: 'S9' });

    expect(result).toEqual({ ok: false, error: 'NOT_YOUR_TURN' });
  });

  it('a follow-up attack card must match a rank already on the table', () => {
    const table = [{ attack: c('S', 7), defense: null }];

    const wrongRank = applyBoutAction(makeState({ table }), 'a', { type: 'attack', cardId: 'C9' });
    const rightRank = applyBoutAction(makeState({ table }), 'a', { type: 'attack', cardId: 'D7' });

    expect(wrongRank).toEqual({ ok: false, error: 'RANK_NOT_ON_TABLE' });
    expect(rightRank.ok).toBe(true);
  });

  it('no attack card fits once the table limit is reached', () => {
    const table = [
      { attack: c('C', 7), defense: null },
      { attack: c('H', 7), defense: null },
    ];

    const result = applyBoutAction(makeState({ table, bout: { limit: 2 } }), 'a', {
      type: 'attack',
      cardId: 'S7',
    });

    expect(result).toEqual({ ok: false, error: 'TABLE_LIMIT' });
  });

  it('any new attack card resets all passes', () => {
    const state = makeState({
      table: [{ attack: c('C', 9), defense: null }],
      bout: { stage: 'open', passed: ['a', 'c'] },
    });

    const result = applyBoutAction(state, 'c', { type: 'attack', cardId: 'S9' });

    expect(result.ok && result.value.state.bout.passed).toEqual([]);
  });

  it('the defender never attacks', () => {
    const result = applyBoutAction(makeState({ bout: { stage: 'open' } }), 'b', {
      type: 'attack',
      cardId: 'S10',
    });

    expect(result).toEqual({ ok: false, error: 'NOT_YOUR_TURN' });
  });
});

describe('applyBoutAction: defend', () => {
  const table = [
    { attack: c('S', 7), defense: null },
    { attack: c('D', 7), defense: null },
  ];

  it('the defender covers a specific attack card', () => {
    const result = applyBoutAction(makeState({ table }), 'b', {
      type: 'defend',
      cardId: 'S10',
      targetAttackIndex: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.table).toEqual([
      { attack: c('S', 7), defense: c('S', 10) },
      { attack: c('D', 7), defense: null },
    ]);
    expect(result.value.state.hands['b']).not.toContainEqual(c('S', 10));
    expect(result.value.resolution).toBeNull();
  });

  it('only the defender may defend', () => {
    const result = applyBoutAction(makeState({ table }), 'c', {
      type: 'defend',
      cardId: 'S9',
      targetAttackIndex: 0,
    });

    expect(result).toEqual({ ok: false, error: 'NOT_YOUR_TURN' });
  });

  it('the defender cannot defend after declaring a take', () => {
    const result = applyBoutAction(makeState({ table, bout: { defenderTaking: true } }), 'b', {
      type: 'defend',
      cardId: 'S10',
      targetAttackIndex: 0,
    });

    expect(result).toEqual({ ok: false, error: 'ILLEGAL_ACTION' });
  });

  it('the target must be an existing, uncovered attack card', () => {
    const covered = [{ attack: c('S', 7), defense: c('S', 8) }, ...table];
    const defend = (targetAttackIndex: number, state = makeState({ table: covered })) =>
      applyBoutAction(state, 'b', { type: 'defend', cardId: 'S10', targetAttackIndex });

    expect(defend(0)).toEqual({ ok: false, error: 'INVALID_TARGET' });
    expect(defend(5)).toEqual({ ok: false, error: 'INVALID_TARGET' });
    expect(defend(-1)).toEqual({ ok: false, error: 'INVALID_TARGET' });
  });

  it('the defense card must beat the target (same suit higher, or a trump)', () => {
    const defend = (cardId: CardId) =>
      applyBoutAction(makeState({ table }), 'b', { type: 'defend', cardId, targetAttackIndex: 0 });

    expect(defend('D8')).toEqual({ ok: false, error: 'CANNOT_BEAT' }); // other suit, not a trump
    expect(defend('H6').ok).toBe(true); // a trump beats a non-trump
  });
});

describe('applyBoutAction: pass', () => {
  const table = [{ attack: c('S', 7), defense: null }];

  it('the main attacker passing opens the bout to the other attackers', () => {
    const result = applyBoutAction(makeState({ table }), 'a', { type: 'pass' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.bout.stage).toBe('open');
    expect(result.value.state.bout.passed).toEqual(['a']);
    expect(result.value.resolution).toBeNull();
  });

  it('only someone who may attack can pass', () => {
    const asDefender = applyBoutAction(makeState({ table, bout: { stage: 'open' } }), 'b', {
      type: 'pass',
    });
    const asOtherInPrimary = applyBoutAction(makeState({ table }), 'c', { type: 'pass' });

    expect(asDefender).toEqual({ ok: false, error: 'NOT_YOUR_TURN' });
    expect(asOtherInPrimary).toEqual({ ok: false, error: 'NOT_YOUR_TURN' });
  });

  it('the opening attack cannot be skipped: passing on an empty table is illegal', () => {
    const result = applyBoutAction(makeState({}), 'a', { type: 'pass' });

    expect(result).toEqual({ ok: false, error: 'ILLEGAL_ACTION' });
  });

  it('in the open stage any other attacker may pass, and passing twice changes nothing', () => {
    const open = makeState({ table, bout: { stage: 'open', passed: ['a'] } });

    const first = applyBoutAction(open, 'c', { type: 'pass' });
    expect(first.ok && first.value.state.bout.passed).toEqual(['a', 'c']);
    if (!first.ok) return;

    const second = applyBoutAction(first.value.state, 'c', { type: 'pass' });
    expect(second.ok && second.value.state.bout.passed).toEqual(['a', 'c']);
  });
});

describe('applyBoutAction: take', () => {
  const table = [
    { attack: c('S', 7), defense: c('S', 10) },
    { attack: c('D', 7), defense: null },
  ];

  it('the defender declares a take while something is uncovered', () => {
    const result = applyBoutAction(makeState({ table }), 'b', { type: 'take' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.bout.defenderTaking).toBe(true);
    expect(result.value.state.table).toEqual(table);
    expect(result.value.resolution).toBeNull();
  });

  it('only the defender may take', () => {
    const result = applyBoutAction(makeState({ table }), 'a', { type: 'take' });

    expect(result).toEqual({ ok: false, error: 'NOT_YOUR_TURN' });
  });

  it('there is nothing to take on an empty table, with everything covered, or twice', () => {
    const covered = [{ attack: c('S', 7), defense: c('S', 10) }];

    expect(applyBoutAction(makeState({}), 'b', { type: 'take' })).toEqual({
      ok: false,
      error: 'ILLEGAL_ACTION',
    });
    expect(applyBoutAction(makeState({ table: covered }), 'b', { type: 'take' })).toEqual({
      ok: false,
      error: 'ILLEGAL_ACTION',
    });
    expect(
      applyBoutAction(makeState({ table, bout: { defenderTaking: true } }), 'b', { type: 'take' }),
    ).toEqual({ ok: false, error: 'ILLEGAL_ACTION' });
  });
});

describe('applyBoutAction: beaten', () => {
  const covered = [{ attack: c('S', 7), defense: c('S', 10) }];

  it('is reached when everything is covered and every attacker has passed', () => {
    const afterMain = applyBoutAction(makeState({ table: covered }), 'a', { type: 'pass' });
    expect(afterMain.ok && afterMain.value.resolution).toBeNull(); // c has not passed yet
    if (!afterMain.ok) return;

    const afterOther = applyBoutAction(afterMain.value.state, 'c', { type: 'pass' });
    expect(afterOther.ok && afterOther.value.resolution).toBe('beaten');
  });

  it('is reached at once when the last slot is covered', () => {
    const table = [{ attack: c('S', 7), defense: null }];
    const state = makeState({ table, bout: { limit: 1 } });

    const result = applyBoutAction(state, 'b', {
      type: 'defend',
      cardId: 'S10',
      targetAttackIndex: 0,
    });

    expect(result.ok && result.value.resolution).toBe('beaten');
  });

  it('is not reached while an attack card is uncovered, even if everyone passed', () => {
    const table = [{ attack: c('S', 7), defense: null }];
    const state = makeState({ table, bout: { stage: 'open', passed: ['a'] } });

    const result = applyBoutAction(state, 'c', { type: 'pass' });

    expect(result.ok && result.value.resolution).toBeNull();
  });
});

describe('applyBoutAction: taken', () => {
  const table = [{ attack: c('S', 7), defense: null }];

  it('the defender takes the table once every attacker has passed', () => {
    const state = makeState({ table, bout: { defenderTaking: true } });

    const afterMain = applyBoutAction(state, 'a', { type: 'pass' });
    expect(afterMain.ok && afterMain.value.resolution).toBeNull();
    if (!afterMain.ok) return;

    const afterOther = applyBoutAction(afterMain.value.state, 'c', { type: 'pass' });
    expect(afterOther.ok && afterOther.value.resolution).toBe('taken');
  });

  it('declaring a take after everyone passed ends the bout at once', () => {
    const state = makeState({ table, bout: { stage: 'open', passed: ['a', 'c'] } });

    const result = applyBoutAction(state, 'b', { type: 'take' });

    expect(result.ok && result.value.resolution).toBe('taken');
  });

  it('a throw-in that fills the table ends the take at once', () => {
    const state = makeState({ table, bout: { defenderTaking: true, limit: 2 } });

    const result = applyBoutAction(state, 'a', { type: 'attack', cardId: 'D7' });

    expect(result.ok && result.value.resolution).toBe('taken');
  });
});

describe('applyBoutAction: attackers without cards', () => {
  const covered = [{ attack: c('S', 7), defense: c('S', 10) }];

  it('an attacker with an empty hand counts as passed', () => {
    const hands = { a: [c('D', 7)], b: [c('H', 6), c('H', 7)], c: [] };

    const result = applyBoutAction(makeState({ hands, table: covered }), 'a', { type: 'pass' });

    expect(result.ok && result.value.resolution).toBe('beaten');
  });

  it('the main attacker emptying their hand hands the bout over to the others', () => {
    const hands = { a: [c('D', 7)], b: [c('H', 6), c('H', 7)], c: [c('S', 9)] };

    const result = applyBoutAction(makeState({ hands, table: covered }), 'a', {
      type: 'attack',
      cardId: 'D7',
    });

    expect(result.ok && result.value.state.bout.stage).toBe('open');
  });
});

describe('applyBoutAction: inconsistent state', () => {
  it('rejects a bout whose roles are not seated at the table', () => {
    const state = makeState({ bout: { defenderId: 'z' } });

    const result = applyBoutAction(state, 'a', { type: 'attack', cardId: 'S7' });

    expect(result).toEqual({ ok: false, error: 'ILLEGAL_ACTION' });
  });

  it('rejects a bout where one player is both attacker and defender', () => {
    const state = makeState({ bout: { defenderId: 'a' } });

    const result = applyBoutAction(state, 'a', { type: 'attack', cardId: 'S7' });

    expect(result).toEqual({ ok: false, error: 'ILLEGAL_ACTION' });
  });

  it('a player who is out of cards cannot pass', () => {
    const hands = { a: [c('D', 7)], b: [c('H', 6), c('H', 7)], c: [] };
    const table = [{ attack: c('S', 7), defense: null }];

    const result = applyBoutAction(makeState({ hands, table, bout: { stage: 'open' } }), 'c', {
      type: 'pass',
    });

    expect(result).toEqual({ ok: false, error: 'ILLEGAL_ACTION' });
  });
});
