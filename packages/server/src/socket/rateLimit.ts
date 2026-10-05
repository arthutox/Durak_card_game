/**
 * Token bucket: allows short bursts (a human tapping fast) but caps the
 * sustained rate, so one misbehaving client cannot flood the server with commands.
 */
export class RateLimiter {
  #tokens: number;
  #last: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly now: () => number = Date.now,
  ) {
    this.#tokens = capacity;
    this.#last = now();
  }

  /** Takes one token; false when the bucket is empty. */
  tryTake(): boolean {
    const time = this.now();
    const elapsedSeconds = Math.max(0, time - this.#last) / 1000;
    this.#last = time;
    this.#tokens = Math.min(this.capacity, this.#tokens + elapsedSeconds * this.refillPerSecond);
    if (this.#tokens < 1) return false;
    this.#tokens -= 1;
    return true;
  }
}

/** Generous for people (a burst of 20, then 10 a second), tiny for a script. */
export const COMMAND_BURST = 20;
export const COMMANDS_PER_SECOND = 10;
