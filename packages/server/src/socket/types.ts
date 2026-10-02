import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '@durak/shared';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type InterServerEvents = {};

export type GameServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
export type GameSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/** Socket.IO rooms used for targeted broadcasts. */
export const CHANNELS = {
  board: 'board',
  players: 'players',
} as const;
