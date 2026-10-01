/**
 * End-to-end lobby flow over a real Socket.IO connection (no mocks):
 * a real server on a random port, real clients from socket.io-client.
 */
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type {
  Ack,
  ClientToServerEvents,
  JoinResult,
  RoomView,
  ServerToClientEvents,
} from '@durak/shared';
import { createGameServer } from '../src/createGameServer.js';
import type { GameServerInstance } from '../src/createGameServer.js';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let server: GameServerInstance;
let url: string;
const clients: ClientSocket[] = [];

beforeEach(async () => {
  server = createGameServer(
    { port: 0, publicPort: 0, isProduction: false, clientDistDir: '' },
    'http://test/play',
  );
  await new Promise<void>((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
  clients.splice(0).forEach((client) => client.disconnect());
  await server.io.close();
});

function client(auth: Record<string, unknown>): ClientSocket {
  const socket: ClientSocket = connect(url, { auth, transports: ['websocket'], forceNew: true });
  clients.push(socket);
  return socket;
}

/** Resolves with the next `room:state` that satisfies the predicate. */
function nextRoomState(socket: ClientSocket, predicate: (view: RoomView) => boolean = () => true) {
  return new Promise<RoomView>((resolve) => {
    const listener = (view: RoomView) => {
      if (!predicate(view)) return;
      socket.off('room:state', listener);
      resolve(view);
    };
    socket.on('room:state', listener);
  });
}

function join(socket: ClientSocket, nickname: string, color: string) {
  return new Promise<Ack<JoinResult>>((resolve) => {
    // `color` is deliberately loose here so tests can send invalid payloads.
    socket.emit('lobby:join', { nickname, color } as never, resolve);
  });
}

describe('lobby over Socket.IO', () => {
  it('sends the current lobby to a board on connect', async () => {
    const view = await nextRoomState(client({ role: 'board' }));
    expect(view).toMatchObject({ phase: 'lobby', players: [], joinUrl: 'http://test/play' });
  });

  it('seats a player and broadcasts the lobby to the board', async () => {
    const board = client({ role: 'board' });
    await nextRoomState(board);
    const boardUpdate = nextRoomState(board, (v) => v.players.length === 1);

    const ack = await join(client({ role: 'player' }), 'Artur', 'red');

    expect(ack.ok).toBe(true);
    const view = await boardUpdate;
    expect(view.players[0]).toMatchObject({ nickname: 'Artur', color: 'red', online: true });
    expect(view.takenColors).toEqual(['red']);
    expect(JSON.stringify(view)).not.toContain(ack.ok ? ack.data.sessionToken : '?');
  });

  it('returns lobby rule errors in the ack', async () => {
    await join(client({ role: 'player' }), 'Artur', 'red');
    const other = client({ role: 'player' });

    expect(await join(other, 'ARTUR', 'blue')).toEqual({ ok: false, error: 'NICKNAME_TAKEN' });
    expect(await join(other, 'Bob', 'red')).toEqual({ ok: false, error: 'COLOR_TAKEN' });
  });

  it('rejects malformed payloads with VALIDATION', async () => {
    expect(await join(client({ role: 'player' }), 'Bob', 'not-a-color')).toEqual({
      ok: false,
      error: 'VALIDATION',
    });
  });

  it('gives the seat back after a reconnect with the session token', async () => {
    const board = client({ role: 'board' });
    await nextRoomState(board);

    const phone = client({ role: 'player' });
    const ack = await join(phone, 'Artur', 'red');
    if (!ack.ok) throw new Error('join failed');

    const wentOffline = nextRoomState(board, (v) => v.players[0]?.online === false);
    phone.disconnect();
    await wentOffline;

    const cameBack = nextRoomState(board, (v) => v.players[0]?.online === true);
    const phoneAgain = client({ role: 'player', sessionToken: ack.data.sessionToken });
    const restored = await new Promise<{ playerId: string }>((resolve) =>
      phoneAgain.once('session:restored', resolve),
    );

    expect(restored.playerId).toBe(ack.data.playerId);
    expect((await cameBack).players).toHaveLength(1);
  });

  it('tells the phone when its token is unknown', async () => {
    const phone = client({ role: 'player', sessionToken: crypto.randomUUID() });
    await new Promise<void>((resolve) => phone.once('session:invalid', resolve));
  });

  it('frees the seat on leave', async () => {
    const board = client({ role: 'board' });
    await nextRoomState(board);
    const phone = client({ role: 'player' });
    await join(phone, 'Artur', 'red');

    const emptied = nextRoomState(board, (v) => v.players.length === 0);
    const ack = await new Promise<Ack<unknown>>((resolve) => phone.emit('lobby:leave', {}, resolve));

    expect(ack.ok).toBe(true);
    await emptied;
  });

  it('rejects a handshake without a valid role', async () => {
    const socket = client({ role: 'admin' });
    const error = await new Promise<Error>((resolve) => socket.once('connect_error', resolve));
    expect(error.message).toBe('VALIDATION');
  });
});
