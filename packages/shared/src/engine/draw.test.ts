import { describe, expect, it } from 'vitest';
import { createDeck } from './deck.js';
import { refillHands } from './draw.js';

// A fixed card pool: the stock is deck[0..9], the starting hands come from the rest.
const deck = createDeck();

describe('refillHands', () => {
  it('refills to 6 cards: main attacker first, other attackers clockwise, defender last', () => {
    const result = refillHands({
      order: ['a', 'b', 'c'],
      attackerId: 'a',
      defenderId: 'b',
      hands: {
        a: deck.slice(10, 14), // 4 cards, needs 2
        b: deck.slice(14, 19), // 5 cards, needs 1
        c: deck.slice(19, 22), // 3 cards, needs 3
      },
      stock: deck.slice(0, 10),
    });

    // The stock is drawn from its end: a gets 9, 8; c gets 7, 6, 5; b gets 4.
    expect(result.hands['a']).toEqual([...deck.slice(10, 14), deck[9], deck[8]]);
    expect(result.hands['c']).toEqual([...deck.slice(19, 22), deck[7], deck[6], deck[5]]);
    expect(result.hands['b']).toEqual([...deck.slice(14, 19), deck[4]]);
    expect(result.stock).toEqual(deck.slice(0, 4));
  });

  it('when the stock runs out mid-refill, later players get less and the defender may get nothing', () => {
    const stock = deck.slice(0, 3);
    const result = refillHands({
      order: ['a', 'b', 'c'],
      attackerId: 'a',
      defenderId: 'b',
      hands: { a: deck.slice(10, 15), b: deck.slice(15, 19), c: deck.slice(19, 23) },
      stock, // a needs 1, c needs 2, b needs 2: only 3 cards for 5 slots
    });

    expect(result.hands['a']).toEqual([...deck.slice(10, 15), deck[2]]);
    expect(result.hands['c']).toEqual([...deck.slice(19, 23), deck[1], deck[0]]); // deck[0] is the trump
    expect(result.hands['b']).toEqual(deck.slice(15, 19));
    expect(result.stock).toEqual([]);
  });

  it('players already holding 6 or more cards (a defender who took) draw nothing', () => {
    const result = refillHands({
      order: ['a', 'b'],
      attackerId: 'a',
      defenderId: 'b',
      hands: { a: deck.slice(10, 15), b: deck.slice(15, 23) }, // 5 and 8 cards
      stock: deck.slice(0, 5),
    });

    expect(result.hands['a']).toHaveLength(6);
    expect(result.hands['b']).toEqual(deck.slice(15, 23));
    expect(result.stock).toEqual(deck.slice(0, 4));
  });

  it('with an empty stock nothing changes, and the input is never mutated', () => {
    const hands = { a: deck.slice(10, 12), b: deck.slice(12, 14) };
    const stock = deck.slice(0, 2);

    const empty = refillHands({
      order: ['a', 'b'],
      attackerId: 'a',
      defenderId: 'b',
      hands,
      stock: [],
    });
    expect(empty.hands).toEqual(hands);

    refillHands({ order: ['a', 'b'], attackerId: 'a', defenderId: 'b', hands, stock });
    expect(stock).toEqual(deck.slice(0, 2));
    expect(hands['a']).toEqual(deck.slice(10, 12));
  });

  it('draws clockwise from the main attacker, wrapping around the table', () => {
    const result = refillHands({
      order: ['a', 'b', 'c', 'd'],
      attackerId: 'c',
      defenderId: 'd',
      hands: {
        a: deck.slice(10, 15),
        b: deck.slice(15, 20),
        c: deck.slice(20, 25),
        d: deck.slice(25, 30),
      },
      stock: deck.slice(0, 3), // c, a, b, d each need 1: d (the defender) is last and gets nothing
    });

    expect(result.hands['c']).toContainEqual(deck[2]);
    expect(result.hands['a']).toContainEqual(deck[1]);
    expect(result.hands['b']).toContainEqual(deck[0]);
    expect(result.hands['d']).toHaveLength(5);
  });

  it('does not create an entry for a player without a hand when the stock is empty', () => {
    const result = refillHands({
      order: ['a', 'b'],
      attackerId: 'a',
      defenderId: 'b',
      hands: { a: deck.slice(10, 16) },
      stock: [],
    });

    expect(result.hands).toEqual({ a: deck.slice(10, 16) });
  });
});
