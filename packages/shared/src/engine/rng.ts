/**
 * Random number source injected into the engine: returns a float in [0, 1).
 * Injecting it (instead of calling Math.random inside the engine) keeps every
 * engine function deterministic and therefore testable.
 */
export type Rng = () => number;

/** Production RNG. */
export const defaultRng: Rng = Math.random;

/**
 * Small seeded PRNG (mulberry32). Used by tests and for reproducible games
 * when debugging ("replay seed 42").
 */
export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [0, maxExclusive). */
export function randomInt(rng: Rng, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive);
}
