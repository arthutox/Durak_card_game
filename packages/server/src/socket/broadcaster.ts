import type { GameEvent, PlayerId } from '@durak/shared';
import { toPlayerView, toPublicView } from '../game/projections.js';
import type { Room } from '../room/Room.js';
import { CHANNELS } from './types.js';
import type { GameServer, GameSocket } from './types.js';

/** All outgoing state fan-out lives here, so handlers only decide *when*. */
export interface Broadcaster {
  /** Lobby snapshot to every connected socket (players, board, not-yet-joined phones). */
  roomState(): void;
  /** Personal snapshot to every online player and the public one to the board. */
  gameState(): void;
  /** The current game snapshot to one freshly (re)connected socket, if a game is running. */
  gameStateTo(socket: GameSocket): void;
  /** Cosmetic events for animations and toasts. */
  gameEvents(events: readonly GameEvent[]): void;
  /** Fun message on the board for a rejected defense. */
  cannotBeat(playerId: PlayerId): void;
}

export function createBroadcaster(io: GameServer, room: Room): Broadcaster {
  const sendTo = (socket: GameSocket): void => {
    const { game } = room;
    if (!game) return;
    if (socket.data.role === 'board') {
      socket.emit('board:state', toPublicView(game, room.seats));
    } else if (socket.data.playerId) {
      socket.emit('game:state', toPlayerView(game, room.seats, socket.data.playerId));
    }
  };

  return {
    roomState: () => {
      io.emit('room:state', room.toView());
    },
    gameState: () => {
      const { game } = room;
      if (!game) return;
      io.to(CHANNELS.board).emit('board:state', toPublicView(game, room.seats));
      for (const seat of room.seats) {
        if (seat.socketId === null) continue;
        io.sockets.sockets
          .get(seat.socketId)
          ?.emit('game:state', toPlayerView(game, room.seats, seat.playerId));
      }
    },
    gameStateTo: sendTo,
    gameEvents: (events) => {
      for (const event of events)
        io.to([CHANNELS.players, CHANNELS.board]).emit('game:event', event);
    },
    cannotBeat: (playerId) => {
      io.to(CHANNELS.board).emit('board:banner', { playerId, kind: 'cannot_beat' });
    },
  };
}
