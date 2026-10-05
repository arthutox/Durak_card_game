/** Host removes a seat over real sockets. */
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { Ack, ClientToServerEvents, RoomView, ServerToClientEvents } from '@durak/shared';
import { createGameServer } from '../src/createGameServer.js';
import type { GameServerInstance } from '../src/createGameServer.js';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let server: GameServerInstance;
let url: string;
const sockets: ClientSocket[] = [];

beforeEach(async () => {
  server = createGameServer(
    { port: 0, publicPort: 0, isProduction: false, clientDistDir: '' },
    'http://test/play',
  );
  await new Promise<void>((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
  sockets.splice(0).forEach((socket) => socket.disconnect());
  server.flow.dispose();
  await server.io.close();
});

function open(auth: Record<string, unknown>): ClientSocket {
  const socket: ClientSocket = connect(url, { auth, transports: ['websocket'], forceNew: true });
  sockets.push(socket);
  return socket;
}

function send(socket: ClientSocket, event: string, payload: unknown): Promise<Ack<unknown>> {
  return new Promise((resolve) => {
    (socket.emit as (...args: unknown[]) => void)(event, payload, resolve);
  });
}

async function until(condition: () => boolean, label: string): Promise<void> {
  for (let i = 0; i < 400; i++) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`timed out: ${label}`);
}

async function join(name: string, color: string) {
  const socket = open({ role: 'player' });
  let kicked = false;
  let room: RoomView | null = null;
  socket.on('session:kicked', () => (kicked = true));
  socket.on('room:state', (view) => (room = view));
  const ack = (await send(socket, 'lobby:join', { nickname: name, color })) as {
    ok: true;
    data: { playerId: string; sessionToken: string };
  };
  expect(ack.ok).toBe(true);
  return { socket, ...ack.data, wasKicked: () => kicked, room: () => room };
}

describe('host:kick', () => {
  it('removes a seat, tells that phone and updates everyone else', async () => {
    const board = open({ role: 'board' });
    const ann = await join('Ann', 'red');
    const bob = await join('Bob', 'blue');

    expect(await send(board, 'host:kick', { playerId: ann.playerId })).toEqual({
      ok: true,
      data: {},
    });

    await until(ann.wasKicked, 'Ann is told');
    await until(() => bob.room()?.players.length === 1, 'Bob sees the new list');
    expect(bob.wasKicked()).toBe(false);
    expect(bob.room()?.players[0]?.nickname).toBe('Bob');
  });

  it('removes an offline seat and frees the way to start', async () => {
    const board = open({ role: 'board' });
    const ann = await join('Ann', 'red');
    await join('Bob', 'blue');
    ann.socket.disconnect();
    await until(() => server.room.seats.some((seat) => seat.socketId === null), 'Ann offline');
    expect(await send(board, 'host:start', {})).toEqual({ ok: false, error: 'PLAYERS_OFFLINE' });

    expect(await send(board, 'host:kick', { playerId: ann.playerId })).toEqual({
      ok: true,
      data: {},
    });
    await join('Cat', 'green');

    expect(await send(board, 'host:start', {})).toEqual({ ok: true, data: {} });
  });

  it('a kicked phone cannot act as its old seat any more', async () => {
    const board = open({ role: 'board' });
    const ann = await join('Ann', 'red');
    await join('Bob', 'blue');
    await send(board, 'host:kick', { playerId: ann.playerId });
    await until(ann.wasKicked, 'Ann is told');

    expect(await send(ann.socket, 'game:pass', {})).toEqual({ ok: false, error: 'NOT_JOINED' });
    const again = open({ role: 'player', sessionToken: ann.sessionToken });
    let invalid = false;
    again.on('session:invalid', () => (invalid = true));
    await until(() => invalid, 'old token rejected');
  });

  it('rejects an unknown seat, bad payloads and kicks during a game', async () => {
    const board = open({ role: 'board' });
    const ann = await join('Ann', 'red');
    await join('Bob', 'blue');

    expect(await send(board, 'host:kick', { playerId: 'nobody' })).toEqual({
      ok: false,
      error: 'NOT_JOINED',
    });
    expect(await send(board, 'host:kick', {})).toEqual({ ok: false, error: 'VALIDATION' });

    await send(board, 'host:start', {});
    expect(await send(board, 'host:kick', { playerId: ann.playerId })).toEqual({
      ok: false,
      error: 'GAME_IN_PROGRESS',
    });
  });
});
