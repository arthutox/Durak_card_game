/**
 * Read models sent from the server to clients. They are projections of the
 * server state and must never contain secrets (session tokens, hidden cards).
 */
import type { Card, Suit } from '../domain/cards.js';
import type { BoutStage } from '../domain/bout.js';
import type { GameOutcome } from '../domain/game.js';
import type { PlayerColor, PlayerId } from '../domain/player.js';
import type { TablePair } from '../domain/table.js';

/** The running turn clock; `null` in the view when the host started without a timer. */
export interface TurnClock {
  /** Time left on this wait, measured by the server when the snapshot was built. */
  readonly remainingMs: number;
  readonly durationMs: number;
  /** Who the game is waiting for: the defender, the attackers, or the main attacker. */
  readonly onClock: readonly PlayerId[];
}

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

export interface GamePlayerView {
  readonly id: PlayerId;
  readonly nickname: string;
  readonly color: PlayerColor;
  /** Only the count: other hands are secret. */
  readonly cardCount: number;
  readonly online: boolean;
  readonly finished: boolean;
}

/** Everything the board (and, as a base, every phone) may know about a running game. */
export interface PublicView {
  readonly version: number;
  /** In seat order, clockwise. */
  readonly players: readonly GamePlayerView[];
  readonly trumpCard: Card;
  readonly trumpSuit: Suit;
  readonly deckCount: number;
  readonly table: readonly TablePair[];
  readonly discardCount: number;
  readonly bout: {
    readonly attackerId: PlayerId;
    readonly defenderId: PlayerId;
    readonly stage: BoutStage;
    readonly defenderTaking: boolean;
    readonly passed: readonly PlayerId[];
    readonly limit: number;
  };
  readonly isFirstBout: boolean;
  readonly turn: TurnClock | null;
  readonly outcome: GameOutcome | null;
}

/** A phone's personal snapshot: the public part plus its own hand. */
export interface PlayerView extends PublicView {
  readonly me: { readonly id: PlayerId; readonly hand: readonly Card[] };
}
