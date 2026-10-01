import type { Room } from '../room/Room.js';
import type { GameServer } from './types.js';

/** All outgoing state fan-out lives here, so handlers only decide *when*. */
export interface Broadcaster {
  /** Lobby snapshot to every connected socket (players, board, not-yet-joined phones). */
  roomState(): void;
}

export function createBroadcaster(io: GameServer, room: Room): Broadcaster {
  return {
    roomState: () => {
      io.emit('room:state', room.toView());
    },
  };
}
