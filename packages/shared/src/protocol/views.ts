/**
 * Read models sent from the server to clients. They are projections of the
 * server state and must never contain secrets (session tokens, hidden cards).
 */
import type { PlayerColor, PlayerId } from '../domain/player.js';

export type RoomPhase = 'lobby' | 'playing' | 'finished';

export interface LobbyPlayerView {
  readonly id: PlayerId;
  readonly nickname: string;
  readonly color: PlayerColor;
  readonly online: boolean;
}

/** Lobby state: broadcast to every connected socket (players and board). */
export interface RoomView {
  readonly phase: RoomPhase;
  /** Seat order = join order = clockwise order at the table. */
  readonly players: readonly LobbyPlayerView[];
  readonly takenColors: readonly PlayerColor[];
  /** URL encoded in the QR code on the board, e.g. http://192.168.1.20:3000/play */
  readonly joinUrl: string;
}
