/**
 * Typed Socket.IO event maps — the single contract between client and server.
 *
 *   server: new Server<ClientToServerEvents, ServerToClientEvents>(httpServer)
 *   client: io() as Socket<ServerToClientEvents, ClientToServerEvents>
 *
 * Grows sprint by sprint; see docs/ARCHITECTURE.md §3 for the full protocol.
 */
import type { PlayerId } from '../domain/player.js';
import type { AckFn } from './ack.js';
import type { EmptyPayload, JoinPayload } from './schemas.js';
import type { RoomView } from './views.js';

export interface JoinResult {
  readonly playerId: PlayerId;
  /** Secret: lets this phone reclaim its seat after a disconnect. */
  readonly sessionToken: string;
}

export interface ClientToServerEvents {
  /** Player: take a seat in the lobby. */
  'lobby:join': (payload: JoinPayload, ack: AckFn<JoinResult>) => void;
  /** Player: free the seat (lobby only). */
  'lobby:leave': (payload: EmptyPayload, ack: AckFn<EmptyPayload>) => void;
}

export interface ServerToClientEvents {
  /** Lobby snapshot, broadcast to everyone on every change. */
  'room:state': (view: RoomView) => void;
  /** The phone sent an unknown session token (e.g. the server restarted). */
  'session:invalid': () => void;
  /** Sent to this phone once its token has been accepted (join or reconnect). */
  'session:restored': (session: { playerId: PlayerId }) => void;
}

/** Per-socket data the server attaches after the handshake. */
export interface SocketData {
  role: 'board' | 'player';
  playerId: PlayerId | null;
}
