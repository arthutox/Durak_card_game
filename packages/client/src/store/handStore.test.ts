import { beforeEach, describe, expect, it } from 'vitest';
import { makeCard } from '@durak/shared';
import type { PlayerView } from '@durak/shared';
import { useHandStore } from './handStore';

const view = (version: number, remainingMs: number | null = null): PlayerView => ({
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
  turn: remainingMs === null ? null : { remainingMs, durationMs: 30_000, onClock: ['a'] },
  isFirstBout: true,
  outcome: null,
  me: { id: 'a', hand: [] },
});

describe('handStore', () => {
  beforeEach(() => useHandStore.getState().clearView());

  it('ignores a snapshot older than the one it already has', () => {
    const { setView } = useHandStore.getState();
    setView(view(5));
    setView(view(4));

    expect(useHandStore.getState().view?.version).toBe(5);
  });

  it('accepts a snapshot with the same version, e.g. a fresh turn clock after a reconnect', () => {
    const { setView } = useHandStore.getState();
    setView(view(5, 20_000));
    setView(view(5, 12_000));

    expect(useHandStore.getState().view?.turn?.remainingMs).toBe(12_000);
  });
});
