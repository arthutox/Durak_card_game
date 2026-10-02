import { describe, expect, it } from 'vitest';
import { makeCard } from '@durak/shared';
import type { PublicView } from '@durak/shared';
import { seatRole, statusLine } from './boardRoles';

const game = (
  overrides: Partial<PublicView['bout']> = {},
  table: PublicView['table'] = [],
): PublicView => ({
  version: 1,
  players: ['a', 'b', 'c'].map((id) => ({
    id,
    nickname: id.toUpperCase(),
    color: 'red',
    cardCount: 6,
    online: true,
    finished: id === 'c' && overrides.stage === undefined,
  })),
  trumpCard: makeCard('H', 6),
  trumpSuit: 'H',
  deckCount: 10,
  table,
  discardCount: 0,
  bout: {
    attackerId: 'a',
    defenderId: 'b',
    stage: 'primary',
    defenderTaking: false,
    passed: [],
    limit: 6,
    ...overrides,
  },
  isFirstBout: false,
  outcome: null,
});

describe('seatRole', () => {
  it('names the attacker and the defender; others wait until the bout opens up', () => {
    const primary = game({ stage: 'primary' });
    expect(seatRole(primary, 'a')).toBe('attacker');
    expect(seatRole(primary, 'b')).toBe('defender');
    expect(seatRole(primary, 'c')).toBe('idle');
    expect(seatRole(game({ stage: 'open' }), 'c')).toBe('thrower');
  });

  it('a finished player is out whatever the bout says', () => {
    expect(seatRole(game(), 'c')).toBe('finished');
  });
});

describe('statusLine', () => {
  const attack = { attack: makeCard('S', 7), defense: null };

  it('says who the table is waiting for', () => {
    expect(statusLine(game())).toBe('A opens the bout');
    expect(statusLine(game({}, [attack]))).toBe('B is defending');
    expect(statusLine(game({ defenderTaking: true }, [attack]))).toBe('B is taking the cards');
    expect(statusLine(game({}, [{ ...attack, defense: makeCard('S', 9) }]))).toBe(
      'A may add a card or pass',
    );
    expect(statusLine(game({ stage: 'open' }, [{ ...attack, defense: makeCard('S', 9) }]))).toBe(
      'Anyone may throw in a card',
    );
  });
});
