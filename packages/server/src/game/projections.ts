/**
 * The anti-cheat boundary: the only place where server-side `GameState` is
 * turned into something a client may see. Other hands, the stock order, the
 * discard contents and session tokens never pass through here.
 */
import type { GamePlayerView, GameState, PlayerId, PlayerView, PublicView } from '@durak/shared';
import type { Seat } from '../room/Room.js';

function playerViews(state: GameState, seats: readonly Seat[]): GamePlayerView[] {
  return state.order.flatMap((id) => {
    const seat = seats.find((candidate) => candidate.playerId === id);
    if (!seat) return [];
    return [
      {
        id,
        nickname: seat.nickname,
        color: seat.color,
        cardCount: state.hands[id]?.length ?? 0,
        online: seat.socketId !== null,
        finished: state.finished.includes(id),
      },
    ];
  });
}

export function toPublicView(state: GameState, seats: readonly Seat[]): PublicView {
  const { bout } = state;
  return {
    version: state.version,
    players: playerViews(state, seats),
    trumpCard: state.trumpCard,
    trumpSuit: state.trumpSuit,
    deckCount: state.deck.length,
    table: state.table,
    discardCount: state.discard.length,
    bout: {
      attackerId: bout.attackerId,
      defenderId: bout.defenderId,
      stage: bout.stage,
      defenderTaking: bout.defenderTaking,
      passed: bout.passed,
      limit: bout.limit,
    },
    isFirstBout: state.isFirstBout,
    outcome: state.outcome,
  };
}

export function toPlayerView(
  state: GameState,
  seats: readonly Seat[],
  viewer: PlayerId,
): PlayerView {
  return {
    ...toPublicView(state, seats),
    me: { id: viewer, hand: state.hands[viewer] ?? [] },
  };
}
