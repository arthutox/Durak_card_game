import { describe, expect, it } from 'vitest';
import { MAX_FAN_CARDS, fanSize, seatPosition } from './seatLayout';

describe('seatPosition', () => {
  it('puts the first seat at the bottom center', () => {
    expect(seatPosition(0, 4)).toEqual({ left: 50, top: 94 });
  });

  it('goes clockwise: with four seats the next one is on the left', () => {
    const second = seatPosition(1, 4);
    expect(second.left).toBeLessThan(10);
    expect(second.top).toBe(50);
    expect(seatPosition(2, 4).top).toBeLessThan(10);
  });

  it('gives every seat of a full table its own spot', () => {
    const spots = Array.from({ length: 6 }, (_, i) => JSON.stringify(seatPosition(i, 6)));
    expect(new Set(spots).size).toBe(6);
  });

  it('places two players opposite each other', () => {
    expect(seatPosition(0, 2).top).toBeGreaterThan(90);
    expect(seatPosition(1, 2).top).toBeLessThan(10);
  });
});

describe('fanSize', () => {
  it('draws one card per card in hand, up to a cap', () => {
    expect(fanSize(0)).toBe(0);
    expect(fanSize(4)).toBe(4);
    expect(fanSize(30)).toBe(MAX_FAN_CARDS);
  });
});
