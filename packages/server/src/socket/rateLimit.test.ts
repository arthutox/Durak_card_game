import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rateLimit.js';

function setup(capacity: number, perSecond: number) {
  let time = 0;
  return {
    limiter: new RateLimiter(capacity, perSecond, () => time),
    advance: (ms: number) => (time += ms),
  };
}

describe('RateLimiter', () => {
  it('allows a burst up to the capacity, then refuses', () => {
    const { limiter } = setup(3, 1);

    expect([limiter.tryTake(), limiter.tryTake(), limiter.tryTake(), limiter.tryTake()]).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it('refills over time', () => {
    const { limiter, advance } = setup(2, 2);
    limiter.tryTake();
    limiter.tryTake();
    expect(limiter.tryTake()).toBe(false);

    advance(500); // one token back at 2 per second

    expect(limiter.tryTake()).toBe(true);
    expect(limiter.tryTake()).toBe(false);
  });

  it('never holds more than the capacity, however long it idles', () => {
    const { limiter, advance } = setup(2, 10);
    advance(60_000);

    expect([limiter.tryTake(), limiter.tryTake(), limiter.tryTake()]).toEqual([true, true, false]);
  });
});
