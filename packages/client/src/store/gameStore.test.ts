import { beforeEach, describe, expect, it } from 'vitest';
import { makeCard } from '@durak/shared';
import type { PublicView } from '@durak/shared';
import { useGameStore } from './gameStore';

const view = (version: number): PublicView => ({
  version,
  players: [],
  trumpCard: makeCard('H', 6),
  trumpSuit: 'H',
  deckCount: 0,
  table: [],
  discardCount: 0,
  bout: {
    attackerId: 'a',
    defenderId: 'b',
    stage: 'primary',
    defenderTaking: false,
    passed: [],
    limit: 6,
  },
  turn: null,
  isFirstBout: true,
  outcome: null,
});

describe('gameStore', () => {
  beforeEach(() => useGameStore.getState().clearGame());

  it('ignores a snapshot older than the one it already has', () => {
    const { setGame } = useGameStore.getState();
    setGame(view(5));
    setGame(view(4));

    expect(useGameStore.getState().game?.version).toBe(5);
  });

  it('accepts a fresh game after the store was cleared (rematch restarts at version 0)', () => {
    const { setGame, clearGame } = useGameStore.getState();
    setGame(view(9));
    clearGame();
    setGame(view(0));

    expect(useGameStore.getState().game?.version).toBe(0);
  });
});
