/**
 * Typed Socket.IO event maps — the single contract between client and server.
 *
 *   server: new Server<ClientToServerEvents, ServerToClientEvents>(httpServer)
 *   client: io() as Socket<ServerToClientEvents, ClientToServerEvents>
 *
 * Grows sprint by sprint; see docs/ARCHITECTURE.md §3 for the full protocol.
 */
import type { GameEvent } from '../domain/game.js';
import type { PlayerId } from '../domain/player.js';
import type { AckFn } from './ack.js';
import type {
  AttackPayload,
  DefendPayload,
  EmptyPayload,
  JoinPayload,
  KickPayload,
  StartPayload,
} from './schemas.js';
import type { PlayerView, PublicView, RoomView } from './views.js';

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
  /** Player: open the bout or throw in a card. */
  'game:attack': (payload: AttackPayload, ack: AckFn<EmptyPayload>) => void;
  /** Player (defender): cover a specific attack card. */
  'game:defend': (payload: DefendPayload, ack: AckFn<EmptyPayload>) => void;
  /** Player (attacker): nothing more to add. */
  'game:pass': (payload: EmptyPayload, ack: AckFn<EmptyPayload>) => void;
  /** Player (defender): give up and take the table. */
  'game:take': (payload: EmptyPayload, ack: AckFn<EmptyPayload>) => void;
  /** Board: start a game with everyone in the lobby, optionally with a turn timer. */
  'host:start': (payload: StartPayload, ack: AckFn<EmptyPayload>) => void;
  /** Board: remove a seat from the lobby (e.g. a phone that died). */
  'host:kick': (payload: KickPayload, ack: AckFn<EmptyPayload>) => void;
  /** Board: abandon the running game and return to the lobby. */
  'host:abort': (payload: EmptyPayload, ack: AckFn<EmptyPayload>) => void;
  /** Board: new game with the same players. */
  'host:rematch': (payload: EmptyPayload, ack: AckFn<EmptyPayload>) => void;
  /** Board: back to the lobby after a finished game. */
  'host:toLobby': (payload: EmptyPayload, ack: AckFn<EmptyPayload>) => void;
}

export interface ServerToClientEvents {
  /** Lobby snapshot, broadcast to everyone on every change. */
  'room:state': (view: RoomView) => void;
  /** The phone sent an unknown session token (e.g. the server restarted). */
  'session:invalid': () => void;
  /** The host removed this phone's seat; it should go back to the join form. */
  'session:kicked': () => void;
  /** Sent to this phone once its token has been accepted (join or reconnect). */
  'session:restored': (session: { playerId: PlayerId }) => void;
  /** Personal snapshot after every game change and on reconnect. */
  'game:state': (view: PlayerView) => void;
  /** Public snapshot for the board. */
  'board:state': (view: PublicView) => void;
  /** Cosmetic only (animations, toasts); clients never derive state from it. */
  'game:event': (event: GameEvent) => void;
  /** Board only: a fun message for a rejected defense. */
  'board:banner': (banner: { playerId: PlayerId; kind: 'cannot_beat' }) => void;
}

/** Per-socket data the server attaches after the handshake. */
export interface SocketData {
  role: 'board' | 'player';
  playerId: PlayerId | null;
}
