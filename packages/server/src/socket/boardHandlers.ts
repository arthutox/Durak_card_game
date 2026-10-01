import type { Room } from '../room/Room.js';
import { CHANNELS } from './types.js';
import type { GameSocket } from './types.js';

interface Context {
  readonly room: Room;
}

/**
 * Wires the host screen. The board is a stateless viewer: on every (re)connect
 * it simply receives the current snapshot. Host commands (start, abort,
 * rematch) arrive in sprint 4.
 */
export function registerBoardHandlers(socket: GameSocket, { room }: Context): void {
  void socket.join(CHANNELS.board);
  socket.emit('room:state', room.toView());
}
