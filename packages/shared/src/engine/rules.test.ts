import { describe, expect, it } from 'vitest';
import { parseCardId as c } from '../domain/cards.js';
import type { TablePair } from '../domain/table.js';
import {
  canBeat,
  canThrowIn,
  isTableCovered,
  ranksOnTable,
  remainingSlots,
  tableLimit,
  validDefenseTargets,
} from './rules.js';

/** Table builder: [['H7', 'H9'], ['S7', null]] → attack/defense pairs. */
const table = (...pairs: Array<[string, string | null]>): TablePair[] =>
  pairs.map(([attack, defense]) => ({ attack: c(attack), defense: defense ? c(defense) : null }));

const TRUMP = 'D' as const; // diamonds are trump in every test below

describe('canBeat', () => {
  it.each([
    ['H7', 'H9', true, 'higher card of the same suit'],
    ['H9', 'H7', false, 'lower card of the same suit'],
    ['H9', 'H9', false, 'equal rank (impossible in one deck, but rule-wise false)'],
    ['H14', 'D6', true, 'any trump beats a non-trump'],
    ['D6', 'H14', false, 'a non-trump never beats a trump'],
    ['D10', 'D11', true, 'higher trump beats lower trump'],
    ['D11', 'D10', false, 'lower trump does not beat higher trump'],
    ['H7', 'S14', false, 'a different non-trump suit never beats'],
  ])('%s ← %s = %s (%s)', (attack, defense, expected) => {
    expect(canBeat(c(attack), c(defense), TRUMP)).toBe(expected);
  });
});

describe('tableLimit', () => {
  it('caps the first bout at 5 cards', () => {
    expect(tableLimit({ defenderHandSize: 6, isFirstBout: true })).toBe(5);
  });

  it('caps later bouts at 6 cards', () => {
    expect(tableLimit({ defenderHandSize: 9, isFirstBout: false })).toBe(6);
  });

  it("never exceeds the defender's hand size at bout start", () => {
    expect(tableLimit({ defenderHandSize: 3, isFirstBout: false })).toBe(3);
    expect(tableLimit({ defenderHandSize: 2, isFirstBout: true })).toBe(2);
  });

  it('is never negative', () => {
    expect(tableLimit({ defenderHandSize: 0, isFirstBout: false })).toBe(0);
  });
});

describe('remainingSlots', () => {
  it('counts attack cards (covered or not) against the limit', () => {
    expect(remainingSlots(table(['H7', 'H9'], ['S7', null]), 6)).toBe(4);
  });

  it('is zero when the limit is reached and never negative', () => {
    expect(remainingSlots(table(['H7', null], ['S7', null]), 2)).toBe(0);
    expect(remainingSlots(table(['H7', null], ['S7', null]), 1)).toBe(0);
  });
});

describe('ranksOnTable', () => {
  it('includes both attack and defense ranks', () => {
    const ranks = [...ranksOnTable(table(['H7', 'H9'], ['S12', null]))];
    expect(ranks.sort((x, y) => x - y)).toEqual([7, 9, 12]);
  });
});

describe('canThrowIn', () => {
  it('allows any card to open an empty table', () => {
    expect(canThrowIn(c('C13'), [], 6)).toBe(true);
  });

  it('allows a card whose rank matches an attack card', () => {
    expect(canThrowIn(c('S7'), table(['H7', null]), 6)).toBe(true);
  });

  it('allows a card whose rank matches a defense card', () => {
    expect(canThrowIn(c('S9'), table(['H7', 'H9']), 6)).toBe(true);
  });

  it('rejects a rank that is not on the table', () => {
    expect(canThrowIn(c('S10'), table(['H7', 'H9']), 6)).toBe(false);
  });

  it('rejects any card once the limit is reached', () => {
    const full = table(['H7', 'H9'], ['S7', null]);
    expect(canThrowIn(c('C7'), full, 2)).toBe(false);
  });

  it('rejects even the opening card when the limit is zero', () => {
    expect(canThrowIn(c('C7'), [], 0)).toBe(false);
  });
});

describe('validDefenseTargets', () => {
  it('returns only uncovered attacks the card can beat', () => {
    const t = table(['H7', 'H9'], ['H8', null], ['S6', null], ['D6', null]);
    // H10 beats H8 (index 1); not S6 (other suit), not D6 (trump); H7 is already covered.
    expect(validDefenseTargets(c('H10'), t, TRUMP)).toEqual([1]);
  });

  it('a trump can target every uncovered non-trump and lower trumps', () => {
    const t = table(['H8', null], ['S6', null], ['D6', null], ['D12', null]);
    expect(validDefenseTargets(c('D7'), t, TRUMP)).toEqual([0, 1, 2]);
  });

  it('returns an empty list when nothing can be beaten', () => {
    expect(validDefenseTargets(c('C6'), table(['H8', null]), TRUMP)).toEqual([]);
  });
});

describe('isTableCovered', () => {
  it('is false for an empty table', () => {
    expect(isTableCovered([])).toBe(false);
  });

  it('is false while any attack is uncovered', () => {
    expect(isTableCovered(table(['H7', 'H9'], ['S7', null]))).toBe(false);
  });

  it('is true when every attack is covered', () => {
    expect(isTableCovered(table(['H7', 'H9'], ['S7', 'D6']))).toBe(true);
  });
});
