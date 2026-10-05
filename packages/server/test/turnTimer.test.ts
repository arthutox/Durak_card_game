import { describe, expect, it } from 'vitest';
import { createSeededRng } from '@durak/shared';
import { createGameFlow } from '../src/socket/gameFlow.js';
import type { Broadcaster } from '../src/socket/broadcaster.js';
import { Room } from '../src/room/Room.js';
import { createManualClock } from './support/manualClock.js';

function setup(turnSeconds: 30 | 60 | 90 | null) {
  const clock = createManualClock();
  let counter = 0;
  const room = new Room({
    generateId: () => `id-${++counter}`,
    joinUrl: 'http://lan/play',
    rng: createSeededRng(7),
    now: clock.now,
  });
  room.join('s1', { nickname: 'Ann', color: 'red' });
  room.join('s2', { nickname: 'Bob', color: 'blue' });

  const broadcasts: string[] = [];
  const broadcast: Broadcaster = {
    roomState: () => broadcasts.push('room'),
    gameState: () => broadcasts.push('game'),
    gameStateTo: () => undefined,
    gameEvents: (events) => broadcasts.push(...events.map((event) => event.type)),
    cannotBeat: () => undefined,
  };
  const flow = createGameFlow({ room, broadcast, scheduler: clock.scheduler });

  expect(room.startGame({ turnSeconds }).ok).toBe(true);
  flow.changed();
  return { room, clock, flow, broadcasts };
}

describe('turn timer', () => {
  it('does nothing when the game starts without a timer', () => {
    const { room, clock } = setup(null);

    expect(room.turnView()).toBeNull();
    expect(clock.pending()).toBe(0);
  });

  it('shows the clock to whoever the game is waiting for', () => {
    const { room, clock } = setup(30);
    const attacker = room.game!.bout.attackerId;

    clock.advance(10_000);

    expect(room.turnView()).toEqual({
      remainingMs: 20_000,
      durationMs: 30_000,
      onClock: [attacker],
    });
  });

  it('attacks for an idle main attacker when the time runs out', () => {
    const { room, clock, broadcasts } = setup(30);
    const attacker = room.game!.bout.attackerId;
    const handSize = room.game!.hands[attacker]!.length;

    clock.advance(30_000);

    expect(room.game!.table).toHaveLength(1);
    expect(room.game!.hands[attacker]).toHaveLength(handSize - 1);
    expect(broadcasts).toContain('attack');
  });

  it('starts a fresh wait after every move, so the old deadline does not fire', () => {
    const { room, clock } = setup(30);
    const attacker = room.game!.bout.attackerId;

    clock.advance(25_000);
    const card = room.game!.hands[attacker]![0]!;
    expect(room.act(attacker, { type: 'attack', cardId: card.id }).ok).toBe(true);
    clock.advance(25_000); // 50 s since the start, but only 25 s into the new wait

    expect(room.game!.table).toHaveLength(1);
    expect(room.turnView()?.remainingMs).toBe(5_000);
  });

  it('makes the defender take after an attack goes unanswered', () => {
    const { room, clock } = setup(30);
    const { defenderId } = room.game!.bout;

    clock.advance(30_000); // main attacker idle: auto-attack
    expect(room.turnView()?.onClock).toEqual([defenderId]);
    clock.advance(30_000); // defender idle

    expect(room.game!.bout.defenderTaking).toBe(true);
    expect(room.turnView()?.onClock).toEqual([room.game!.bout.attackerId]);
  });

  it('keeps the same timer length for a rematch and clears it in the lobby', () => {
    const { room, clock, flow } = setup(60);

    room.abort();
    flow.changed();
    expect(room.turnView()).toBeNull();
    expect(clock.pending()).toBe(0);

    room.startGame({ turnSeconds: 60 });
    flow.changed();
    expect(clock.pending()).toBe(1);
  });

  it('stops the pending timer on dispose', () => {
    const { clock, flow } = setup(30);

    flow.dispose();

    expect(clock.pending()).toBe(0);
  });
});
