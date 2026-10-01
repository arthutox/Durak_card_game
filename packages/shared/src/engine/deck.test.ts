import { describe, expect, it } from 'vitest';
import type { Card } from '../domain/cards.js';
import { createDeck, deal, shuffle } from './deck.js';
import { createSeededRng } from './rng.js';

const ids = (cards: readonly Card[]) => cards.map((card) => card.id);
const players = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

describe('createDeck', () => {
  it('has 36 unique cards: 4 suits × ranks 6..14', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(36);
    expect(new Set(ids(deck)).size).toBe(36);
    expect(Math.min(...deck.map((card) => card.rank))).toBe(6);
    expect(Math.max(...deck.map((card) => card.rank))).toBe(14);
  });
});

describe('shuffle', () => {
  it('is deterministic for the same seed', () => {
    const a = shuffle(createDeck(), createSeededRng(42));
    const b = shuffle(createDeck(), createSeededRng(42));
    expect(ids(a)).toEqual(ids(b));
  });

  it('returns a permutation and does not mutate the input', () => {
    const deck = createDeck();
    const before = ids(deck);
    const shuffled = shuffle(deck, createSeededRng(7));

    expect(ids(deck)).toEqual(before);
    expect(ids(shuffled)).not.toEqual(before);
    expect([...ids(shuffled)].sort()).toEqual([...before].sort());
  });
});

describe('deal', () => {
  const shuffled = () => shuffle(createDeck(), createSeededRng(1));

  it('gives every player 6 cards and keeps the rest as stock', () => {
    const { hands, stock } = deal(shuffled(), players(2));
    expect(hands.p1).toHaveLength(6);
    expect(hands.p2).toHaveLength(6);
    expect(stock).toHaveLength(24);
  });

  it('deals one card at a time, clockwise, from the top (end) of the deck', () => {
    const deck = shuffled();
    const { hands } = deal(deck, players(2));
    expect(hands.p1![0]).toEqual(deck[35]);
    expect(hands.p2![0]).toEqual(deck[34]);
    expect(hands.p1![1]).toEqual(deck[33]);
  });

  it('reveals the bottom card of the stock as trump, which stays in the stock', () => {
    const deck = shuffled();
    const { stock, trumpCard } = deal(deck, players(3));
    expect(trumpCard).toEqual(deck[0]);
    expect(stock[0]).toEqual(trumpCard);
  });

  it('with 6 players deals the whole deck and reveals the last dealt card as trump', () => {
    const { hands, stock, trumpCard } = deal(shuffled(), players(6));
    expect(stock).toHaveLength(0);
    expect(hands.p6!.at(-1)).toEqual(trumpCard);
  });

  it.each([2, 3, 4, 5, 6])('conserves all 36 cards with %i players', (n) => {
    const { hands, stock } = deal(shuffled(), players(n));
    const all = [...Object.values(hands).flat(), ...stock];
    expect(new Set(ids(all)).size).toBe(36);
    expect(all).toHaveLength(36);
  });

  it('rejects fewer than 2 or more than 6 players', () => {
    expect(() => deal(shuffled(), players(1))).toThrow(RangeError);
    expect(() => deal(shuffled(), players(7))).toThrow(RangeError);
  });

  it('rejects duplicate player ids', () => {
    expect(() => deal(shuffled(), ['p1', 'p1'])).toThrow();
  });
});
