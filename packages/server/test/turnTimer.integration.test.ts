/** The turn timer over real sockets, with a manual clock instead of waiting. */
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type {
  Ack,
  ClientToServerEvents,
  PlayerView,
  PublicView,
  ServerToClientEvents,
} from '@durak/shared';
import { createGameServer } from '../src/createGameServer.js';
import type { GameServerInstance } from '../src/createGameServer.js';
import { createManualClock } from './support/manualClock.js';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const clock = createManualClock();
let server: GameServerInstance;
let url: string;
const sockets: ClientSocket[] = [];

beforeEach(async () => {
  server = createGameServer(
    { port: 0, publicPort: 0, isProduction: false, clientDistDir: '' },
    'http://test/play',
    clock,
  );
  await new Promise<void>((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
  server.flow.dispose();
  sockets.splice(0).forEach((socket) => socket.disconnect());
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

async function startGame(payload: unknown) {
  const board = open({ role: 'board' });
  let boardView: PublicView | null = null;
  board.on('board:state', (view) => (boardView = view));
  const views: (PlayerView | null)[] = [null, null];
  for (const [i, name] of ['Ann', 'Bob'].entries()) {
    const phone = open({ role: 'player' });
    phone.on('game:state', (view) => (views[i] = view));
    await send(phone, 'lobby:join', { nickname: name, color: i === 0 ? 'red' : 'blue' });
  }
  expect(await send(board, 'host:start', payload)).toEqual({ ok: true, data: {} });
  await until(() => boardView !== null && views.every(Boolean), 'first snapshots');
  return { board, getBoardView: () => boardView!, views };
}

describe('turn timer over sockets', () => {
  it('sends the clock in every snapshot and plays the timeout move', async () => {
    const { getBoardView, views } = await startGame({ turnSeconds: 30 });

    expect(getBoardView().turn).toMatchObject({ remainingMs: 30_000, durationMs: 30_000 });
    expect(views[0]!.turn).toEqual(getBoardView().turn);
    expect(getBoardView().table).toHaveLength(0);

    clock.advance(30_000);
    await until(() => getBoardView().table.length === 1, 'auto attack on the board');
    await until(() => views.every((view) => view!.table.length === 1), 'auto attack on phones');

    expect(getBoardView().turn?.remainingMs).toBe(30_000);
  });

  it('sends no clock when started without a timer', async () => {
    const { getBoardView, views } = await startGame({});

    expect(getBoardView().turn).toBeNull();
    expect(views[0]!.turn).toBeNull();
    expect(clock.pending()).toBe(0);
  });

  it('rejects an unsupported timer length', async () => {
    const board = open({ role: 'board' });
    expect(await send(board, 'host:start', { turnSeconds: 5 })).toEqual({
      ok: false,
      error: 'VALIDATION',
    });
  });
});
