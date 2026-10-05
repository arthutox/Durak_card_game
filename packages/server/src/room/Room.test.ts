import { describe, expect, it } from 'vitest';
import { Room } from './Room.js';

function createRoom() {
  let counter = 0;
  return new Room({ generateId: () => `id-${++counter}`, joinUrl: 'http://lan:3000/play' });
}

describe('Room.join', () => {
  it('seats a player with a public id and a separate secret token', () => {
    const room = createRoom();
    const result = room.join('s1', { nickname: 'Artur', color: 'red' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.playerId).not.toBe(result.value.sessionToken);
    expect(room.seats).toHaveLength(1);
  });

  it('normalizes the nickname', () => {
    const room = createRoom();
    const result = room.join('s1', { nickname: '  Big   Boss ', color: 'red' });
    expect(result.ok && result.value.nickname).toBe('Big Boss');
  });

  it.each([
    ['', 'NICKNAME_INVALID'],
    ['   ', 'NICKNAME_INVALID'],
    ['x'.repeat(17), 'NICKNAME_INVALID'],
  ])('rejects nickname %j with %s', (nickname, error) => {
    expect(createRoom().join('s1', { nickname, color: 'red' })).toEqual({ ok: false, error });
  });

  it('rejects a nickname taken case-insensitively', () => {
    const room = createRoom();
    room.join('s1', { nickname: 'Artur', color: 'red' });
    expect(room.join('s2', { nickname: ' artur ', color: 'blue' })).toEqual({
      ok: false,
      error: 'NICKNAME_TAKEN',
    });
  });

  it('rejects a taken color', () => {
    const room = createRoom();
    room.join('s1', { nickname: 'A', color: 'red' });
    expect(room.join('s2', { nickname: 'B', color: 'red' })).toEqual({
      ok: false,
      error: 'COLOR_TAKEN',
    });
  });

  it('rejects a second seat for the same socket', () => {
    const room = createRoom();
    room.join('s1', { nickname: 'A', color: 'red' });
    expect(room.join('s1', { nickname: 'B', color: 'blue' })).toEqual({
      ok: false,
      error: 'ALREADY_JOINED',
    });
  });

  it('accepts at most 6 players', () => {
    const room = createRoom();
    const colors = ['red', 'orange', 'yellow', 'green', 'teal', 'blue'] as const;
    colors.forEach((color, i) => room.join(`s${i}`, { nickname: `P${i}`, color }));
    expect(room.join('s7', { nickname: 'P7', color: 'pink' })).toEqual({
      ok: false,
      error: 'ROOM_FULL',
    });
  });
});

describe('Room sessions', () => {
  it('keeps the seat when the phone disconnects and restores it by token', () => {
    const room = createRoom();
    const joined = room.join('s1', { nickname: 'A', color: 'red' });
    if (!joined.ok) throw new Error('join failed');

    room.disconnect('s1');
    expect(room.toView().players[0]?.online).toBe(false);

    const resumed = room.resume(joined.value.sessionToken, 's2');
    expect(resumed?.seat.playerId).toBe(joined.value.playerId);
    expect(resumed?.replacedSocketId).toBeNull();
    expect(room.toView().players[0]?.online).toBe(true);
  });

  it('reports the previous socket when a second connection takes over the seat', () => {
    const room = createRoom();
    const joined = room.join('s1', { nickname: 'A', color: 'red' });
    if (!joined.ok) throw new Error('join failed');

    expect(room.resume(joined.value.sessionToken, 's2')?.replacedSocketId).toBe('s1');
    // The old socket's disconnect must not mark the seat offline.
    room.disconnect('s1');
    expect(room.toView().players[0]?.online).toBe(true);
  });

  it('returns null for an unknown token', () => {
    expect(createRoom().resume('nope', 's1')).toBeNull();
  });

  it('frees the seat and color on leave', () => {
    const room = createRoom();
    const joined = room.join('s1', { nickname: 'A', color: 'red' });
    if (!joined.ok) throw new Error('join failed');

    expect(room.leave(joined.value.playerId).ok).toBe(true);
    expect(room.seats).toHaveLength(0);
    expect(room.join('s2', { nickname: 'A', color: 'red' }).ok).toBe(true);
  });
});

describe('Room.toView', () => {
  it('never exposes session tokens or socket ids', () => {
    const room = createRoom();
    const joined = room.join('socket-secret', { nickname: 'A', color: 'red' });
    if (!joined.ok) throw new Error('join failed');

    const json = JSON.stringify(room.toView());
    expect(json).not.toContain(joined.value.sessionToken);
    expect(json).not.toContain('socket-secret');
  });
});

describe('Room.kick', () => {
  function roomWithPlayers() {
    const room = createRoom();
    const a = room.join('s1', { nickname: 'A', color: 'red' });
    const b = room.join('s2', { nickname: 'B', color: 'blue' });
    if (!a.ok || !b.ok) throw new Error('join failed');
    return { room, a: a.value, b: b.value };
  }

  it('removes the seat and hands it back, even when the phone is offline', () => {
    const { room, a } = roomWithPlayers();
    room.disconnect('s1');

    const result = room.kick(a.playerId);

    expect(result.ok && result.value.playerId).toBe(a.playerId);
    expect(room.seats.map((seat) => seat.nickname)).toEqual(['B']);
    // The old session token no longer works and the color is free again.
    expect(room.resume(a.sessionToken, 's3')).toBeNull();
    expect(room.join('s4', { nickname: 'C', color: 'red' }).ok).toBe(true);
  });

  it('rejects an unknown player', () => {
    expect(roomWithPlayers().room.kick('nobody')).toEqual({ ok: false, error: 'NOT_JOINED' });
  });

  it('is a lobby-only action', () => {
    const { room, a } = roomWithPlayers();
    expect(room.startGame().ok).toBe(true);

    expect(room.kick(a.playerId)).toEqual({ ok: false, error: 'GAME_IN_PROGRESS' });
    expect(room.seats).toHaveLength(2);
  });

  it('lets the host start again once the dead seat is gone', () => {
    const { room, a } = roomWithPlayers();
    room.disconnect('s1');
    expect(room.startGame()).toEqual({ ok: false, error: 'PLAYERS_OFFLINE' });

    room.kick(a.playerId);
    room.join('s5', { nickname: 'C', color: 'green' });

    expect(room.startGame().ok).toBe(true);
  });
});
