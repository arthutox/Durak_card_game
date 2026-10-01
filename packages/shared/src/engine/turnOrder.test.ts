import { describe, expect, it } from 'vitest';
import { parseCardId as c } from '../domain/cards.js';
import { createSeededRng } from './rng.js';
import { firstAttacker, nextActive } from './turnOrder.js';

const ORDER = ['a', 'b', 'c', 'd'];
const everyone = () => true;

describe('nextActive', () => {
  it('returns the next player clockwise', () => {
    expect(nextActive(ORDER, 'a', everyone)).toBe('b');
  });

  it('wraps around the table', () => {
    expect(nextActive(ORDER, 'd', everyone)).toBe('a');
  });

  it('skips finished players', () => {
    const finished = new Set(['b', 'c']);
    expect(nextActive(ORDER, 'a', (id) => !finished.has(id))).toBe('d');
  });

  it('comes back to the start player only after a full lap', () => {
    expect(nextActive(ORDER, 'a', (id) => id === 'a')).toBe('a');
  });

  it('returns null when nobody is active', () => {
    expect(nextActive(ORDER, 'a', () => false)).toBeNull();
  });

  it('throws for an unknown player', () => {
    expect(() => nextActive(ORDER, 'x', everyone)).toThrow();
  });
});

describe('firstAttacker', () => {
  const rng = createSeededRng(3);

  it('picks the holder of the lowest trump', () => {
    const hands = {
      a: [c('H6'), c('S14')],
      b: [c('D9'), c('C6')],
      c: [c('D7'), c('H14')],
    };
    expect(firstAttacker(['a', 'b', 'c'], hands, 'D', rng)).toBe('c');
  });

  it('ignores low non-trump cards', () => {
    const hands = { a: [c('S6'), c('H6')], b: [c('D14')] };
    expect(firstAttacker(['a', 'b'], hands, 'D', rng)).toBe('b');
  });

  it('falls back to a random player (deterministic per seed) when nobody has a trump', () => {
    const hands = { a: [c('S6')], b: [c('H6')], c: [c('C6')] };
    const pick = () => firstAttacker(['a', 'b', 'c'], hands, 'D', createSeededRng(10));
    expect(['a', 'b', 'c']).toContain(pick());
    expect(pick()).toBe(pick());
  });
});
