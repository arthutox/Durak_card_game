import { describe, expect, it } from 'vitest';
import { TurnDeadline } from './TurnDeadline.js';

function setup() {
  let time = 1_000;
  const deadline = new TurnDeadline(() => time);
  return { deadline, advance: (ms: number) => (time += ms) };
}

describe('TurnDeadline', () => {
  it('has no deadline until a length is chosen and a wait is started', () => {
    const { deadline } = setup();
    deadline.restart(true);

    expect(deadline.expiry).toBeNull();
    expect(deadline.remainingMs).toBeNull();
    expect(deadline.durationMs).toBeNull();
  });

  it('counts down from the chosen length', () => {
    const { deadline, advance } = setup();
    deadline.setSeconds(30);
    deadline.restart(true);
    advance(12_000);

    expect(deadline.remainingMs).toBe(18_000);
    expect(deadline.durationMs).toBe(30_000);
    expect(deadline.expiry?.inMs).toBe(18_000);
  });

  it('never reports negative time', () => {
    const { deadline, advance } = setup();
    deadline.setSeconds(30);
    deadline.restart(true);
    advance(45_000);

    expect(deadline.remainingMs).toBe(0);
  });

  it('gives every wait a fresh token, so an earlier timer can tell it is stale', () => {
    const { deadline } = setup();
    deadline.setSeconds(30);
    deadline.restart(true);
    const first = deadline.expiry!.token;
    deadline.restart(true);

    expect(deadline.isCurrent(first)).toBe(false);
    expect(deadline.isCurrent(deadline.expiry!.token)).toBe(true);
  });

  it('clears the deadline when nothing is running, but keeps the length for a rematch', () => {
    const { deadline } = setup();
    deadline.setSeconds(60);
    deadline.restart(true);
    deadline.restart(false);

    expect(deadline.expiry).toBeNull();
    expect(deadline.seconds).toBe(60);
  });

  it('forgets everything in the lobby', () => {
    const { deadline } = setup();
    deadline.setSeconds(90);
    deadline.restart(true);
    deadline.clear();

    expect(deadline.seconds).toBeNull();
    expect(deadline.expiry).toBeNull();
    expect(deadline.isCurrent(1)).toBe(false);
  });
});
