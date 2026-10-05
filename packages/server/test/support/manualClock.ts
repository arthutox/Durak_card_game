import type { Scheduler } from '../../src/game/TurnTimer.js';

/** Time that moves only when a test says so: `advance(ms)` fires every timer that became due. */
export function createManualClock(): {
  now: () => number;
  scheduler: Scheduler;
  advance: (ms: number) => void;
  pending: () => number;
} {
  let time = 1_000;
  let nextId = 1;
  const timers = new Map<number, { at: number; callback: () => void }>();

  return {
    now: () => time,
    pending: () => timers.size,
    scheduler: {
      setTimeout: (callback, ms) => {
        const id = nextId++;
        timers.set(id, { at: time + ms, callback });
        return id;
      },
      clearTimeout: (handle) => {
        timers.delete(handle as number);
      },
    },
    advance: (ms) => {
      const target = time + ms;
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, timer]) => timer.at <= target)
          .sort(([, a], [, b]) => a.at - b.at)[0];
        if (!due) break;
        const [id, timer] = due;
        timers.delete(id);
        time = Math.max(time, timer.at);
        timer.callback();
      }
      time = target;
    },
  };
}
