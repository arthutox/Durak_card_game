import { useEffect, useState } from 'react';
import type { TurnClock } from '@durak/shared';

/** The last seconds are shown in the warning color. */
export const URGENT_SECONDS = 5;

const TICK_MS = 250;

/**
 * Whole seconds left on the turn clock, or null without a timer. Counts down
 * locally from the `remainingMs` the server measured when it built the
 * snapshot, so the phones' own clocks don't matter.
 */
export function useCountdown(turn: TurnClock | null): number | null {
  const [elapsed, setElapsed] = useState({ turn, ms: 0 });

  useEffect(() => {
    if (!turn) return;
    const receivedAt = performance.now();
    const id = setInterval(() => setElapsed({ turn, ms: performance.now() - receivedAt }), TICK_MS);
    return () => clearInterval(id);
  }, [turn]);

  if (!turn) return null;
  // Until the first tick for this snapshot, nothing has elapsed yet.
  const ms = elapsed.turn === turn ? elapsed.ms : 0;
  return Math.max(0, Math.ceil((turn.remainingMs - ms) / 1000));
}
