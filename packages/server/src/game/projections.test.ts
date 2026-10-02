import { createGame, createSeededRng } from '@durak/shared';
import { describe, expect, it } from 'vitest';
import type { Seat } from '../room/Room.js';
import { toPlayerView, toPublicView } from './projections.js';

const ids = ['a', 'b', 'c'];
const seats: Seat[] = ids.map((playerId, i) => ({
  playerId,
  sessionToken: `secret-token-${playerId}`,
  nickname: playerId.toUpperCase(),
  color: (['red', 'blue', 'green'] as const)[i]!,
  socketId: playerId === 'c' ? null : `socket-${playerId}`,
}));

describe('projections', () => {
  const state = createGame(ids, createSeededRng(7));

  it("a player's view holds only their own hand", () => {
    const json = JSON.stringify(toPlayerView(state, seats, 'a'));
    const trumpId = state.trumpCard.id;

    const secret = [...state.hands['b']!, ...state.hands['c']!, ...state.deck].filter(
      (card) => card.id !== trumpId,
    );
    for (const card of secret) expect(json).not.toContain(`"${card.id}"`);
    for (const card of state.hands['a']!) expect(json).toContain(`"${card.id}"`);
  });

  it('never exposes session tokens, in either view', () => {
    expect(JSON.stringify(toPlayerView(state, seats, 'a'))).not.toContain('secret-token');
    expect(JSON.stringify(toPublicView(state, seats))).not.toContain('secret-token');
  });

  it('the public view carries no hand at all and only counts for the stock', () => {
    const view = toPublicView(state, seats);

    expect(view).not.toHaveProperty('me');
    expect(view.deckCount).toBe(state.deck.length);
    expect(view.players.map((p) => p.cardCount)).toEqual([6, 6, 6]);
    expect(view.players.map((p) => p.online)).toEqual([true, true, false]);
    expect(JSON.stringify(view)).not.toContain('"hands"');
  });
});
