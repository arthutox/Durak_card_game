import type { Room } from '../room/Room.js';

/** Timer functions behind an interface so tests can drive time by hand. */
export interface Scheduler {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const realScheduler: Scheduler = {
  setTimeout: (callback, ms) => {
    const handle = setTimeout(callback, ms);
    // A pending turn must not keep a closing process (or a finished test) alive.
    handle.unref();
    return handle;
  },
  clearTimeout: (handle) => {
    clearTimeout(handle as NodeJS.Timeout);
  },
};

/**
 * Keeps one pending timeout in step with the room's current wait. `sync()` is
 * idempotent: call it after every change; it re-arms only when the wait is new.
 */
export class TurnTimer {
  #handle: unknown = null;
  #armedToken: number | null = null;

  constructor(
    private readonly room: Pick<Room, 'turnExpiry'>,
    private readonly scheduler: Scheduler,
    private readonly onExpire: (token: number) => void,
  ) {}

  sync(): void {
    const expiry = this.room.turnExpiry;
    if (!expiry) {
      this.dispose();
      return;
    }
    if (expiry.token === this.#armedToken) return;

    this.dispose();
    this.#armedToken = expiry.token;
    this.#handle = this.scheduler.setTimeout(() => {
      this.#handle = null;
      this.#armedToken = null;
      this.onExpire(expiry.token);
    }, expiry.inMs);
  }

  dispose(): void {
    if (this.#handle !== null) this.scheduler.clearTimeout(this.#handle);
    this.#handle = null;
    this.#armedToken = null;
  }
}
