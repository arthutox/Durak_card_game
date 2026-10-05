import type { TurnSeconds } from '@durak/shared';

/**
 * Deadline bookkeeping for the turn timer: the chosen length and the current
 * wait. Every wait gets a fresh token, so a timer armed for an earlier wait can
 * tell that it is stale. Knows nothing about games; `Room` decides when a wait
 * starts and `TurnTimer` schedules the callback.
 */
export class TurnDeadline {
  #seconds: TurnSeconds | null = null;
  #current: { readonly token: number; readonly deadlineAt: number } | null = null;
  #counter = 0;

  constructor(private readonly now: () => number) {}

  /** The length chosen for the running game; null means no timer. */
  get seconds(): TurnSeconds | null {
    return this.#seconds;
  }

  /** Picks the timer length for a new game (null = off). Call `restart` right after. */
  setSeconds(seconds: TurnSeconds | null): void {
    this.#seconds = seconds;
  }

  /** Starts a new wait, or clears the deadline when nothing is running or there is no timer. */
  restart(running: boolean): void {
    this.#current =
      running && this.#seconds !== null
        ? { token: ++this.#counter, deadlineAt: this.now() + this.#seconds * 1000 }
        : null;
  }

  /** Back to the lobby: no length, no deadline. */
  clear(): void {
    this.#seconds = null;
    this.#current = null;
  }

  /** Is `token` the wait that is still going on? */
  isCurrent(token: number): boolean {
    return this.#current?.token === token;
  }

  /** When the current wait expires, for the timer service; null without a running timer. */
  get expiry(): { readonly token: number; readonly inMs: number } | null {
    const remainingMs = this.remainingMs;
    return this.#current && remainingMs !== null
      ? { token: this.#current.token, inMs: remainingMs }
      : null;
  }

  /** Time left on the current wait, or null without a running timer. */
  get remainingMs(): number | null {
    return this.#current ? Math.max(0, this.#current.deadlineAt - this.now()) : null;
  }

  get durationMs(): number | null {
    return this.#seconds === null ? null : this.#seconds * 1000;
  }
}
