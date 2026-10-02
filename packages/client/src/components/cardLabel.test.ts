import { describe, expect, it } from 'vitest';
import { makeCard } from '@durak/shared';
import { cardLabel, isRedSuit } from './cardLabel';

describe('cardLabel', () => {
  it('shows number ranks and face letters with the suit symbol', () => {
    expect(cardLabel(makeCard('H', 10))).toBe('10♥');
    expect(cardLabel(makeCard('S', 6))).toBe('6♠');
    expect(cardLabel(makeCard('D', 11))).toBe('J♦');
    expect(cardLabel(makeCard('C', 14))).toBe('A♣');
  });

  it('hearts and diamonds are red', () => {
    expect(['S', 'H', 'D', 'C'].filter((s) => isRedSuit(s as 'S'))).toEqual(['H', 'D']);
  });
});
