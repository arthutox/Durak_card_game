import { MAX_PLAYERS, err, ok } from '@durak/shared';
import type {
  ErrorCode,
  JoinPayload,
  PlayerColor,
  PlayerId,
  Result,
  RoomPhase,
  RoomView,
} from '@durak/shared';
import { normalizeNickname, sameNickname } from './lobbyRules.js';

/** A taken place at the table. Lives on the server only. */
export interface Seat {
  readonly playerId: PlayerId;
  /** Secret bearer token. Sent only to its owner, never broadcast or logged. */
  readonly sessionToken: string;
  readonly nickname: string;
  readonly color: PlayerColor;
  /** Current socket, or null while the phone is offline. */
  socketId: string | null;
}

export interface RoomDeps {
  /** UUID generator (injected so tests can be deterministic). */
  readonly generateId: () => string;
  readonly joinUrl: string;
}

export interface ResumeResult {
  readonly seat: Seat;
  /** Socket that held the seat before (another tab / stale connection), if any. */
  readonly replacedSocketId: string | null;
}

/**
 * The single stateful object of the server: lobby seats, sessions and (later)
 * the running game. Knows nothing about Socket.IO — it is driven by socket
 * handlers and is unit-testable on its own.
 */
export class Room {
  #phase: RoomPhase = 'lobby';
  readonly #seats: Seat[] = [];

  constructor(private readonly deps: RoomDeps) {}

  get phase(): RoomPhase {
    return this.#phase;
  }

  get seats(): readonly Seat[] {
    return this.#seats;
  }

  join(socketId: string, payload: JoinPayload): Result<Seat, ErrorCode> {
    if (this.#phase !== 'lobby') return err('GAME_IN_PROGRESS');
    if (this.findBySocket(socketId)) return err('ALREADY_JOINED');
    if (this.#seats.length >= MAX_PLAYERS) return err('ROOM_FULL');

    const nickname = normalizeNickname(payload.nickname);
    if (nickname === null) return err('NICKNAME_INVALID');
    if (this.#seats.some((seat) => sameNickname(seat.nickname, nickname))) {
      return err('NICKNAME_TAKEN');
    }
    if (this.#seats.some((seat) => seat.color === payload.color)) return err('COLOR_TAKEN');

    const seat: Seat = {
      playerId: this.deps.generateId(),
      sessionToken: this.deps.generateId(),
      nickname,
      color: payload.color,
      socketId,
    };
    this.#seats.push(seat);
    return ok(seat);
  }

  leave(playerId: PlayerId): Result<void, ErrorCode> {
    if (this.#phase !== 'lobby') return err('GAME_IN_PROGRESS');
    const index = this.#seats.findIndex((seat) => seat.playerId === playerId);
    if (index === -1) return err('NOT_JOINED');
    this.#seats.splice(index, 1);
    return ok(undefined);
  }

  /** Re-attaches a phone to its seat by session token. Newest connection wins. */
  resume(sessionToken: string, socketId: string): ResumeResult | null {
    const seat = this.#seats.find((s) => s.sessionToken === sessionToken);
    if (!seat) return null;

    const replaced = seat.socketId !== socketId ? seat.socketId : null;
    seat.socketId = socketId;
    return { seat, replacedSocketId: replaced };
  }

  /** Marks the seat offline. The seat itself is kept for reconnects. */
  disconnect(socketId: string): Seat | null {
    const seat = this.findBySocket(socketId);
    if (seat) seat.socketId = null;
    return seat ?? null;
  }

  findBySocket(socketId: string): Seat | undefined {
    return this.#seats.find((seat) => seat.socketId === socketId);
  }

  /** Public projection: no tokens, no socket ids. */
  toView(): RoomView {
    return {
      phase: this.#phase,
      players: this.#seats.map((seat) => ({
        id: seat.playerId,
        nickname: seat.nickname,
        color: seat.color,
        online: seat.socketId !== null,
      })),
      takenColors: this.#seats.map((seat) => seat.color),
      joinUrl: this.deps.joinUrl,
    };
  }
}
