/**
 * Snapshots that change without a move (presence, the turn clock) and commands
 * that race each other: both rely on the server being the single writer.
 */
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

interface Phone {
  socket: ClientSocket;
  playerId: string;
  token: string;
  view: PlayerView | null;
}

async function seat(board: ClientSocket, names: readonly string[]): Promise<Phone[]> {
  const phones: Phone[] = [];
  for (const [i, nickname] of names.entries()) {
    const socket = open({ role: 'player' });
    const phone: Phone = { socket, playerId: '', token: '', view: null };
    socket.on('game:state', (view) => (phone.view = view));
    const ack = (await send(socket, 'lobby:join', {
      nickname,
      color: ['red', 'blue', 'green'][i],
    })) as { ok: true; data: { playerId: string; sessionToken: string } };
    phone.playerId = ack.data.playerId;
    phone.token = ack.data.sessionToken;
    phones.push(phone);
  }
  return phones;
}

function openBoard(): { socket: ClientSocket; view: () => PublicView | null } {
  const socket = open({ role: 'board' });
  let view: PublicView | null = null;
  socket.on('board:state', (next) => (view = next));
  return { socket, view: () => view };
}

describe('presence and the turn clock arrive without a new move', () => {
  it('tells the board that a phone went offline and came back, under the same version', async () => {
    const board = openBoard();
    const [ann, bob] = await seat(board.socket, ['Ann', 'Bob']);
    await send(board.socket, 'host:start', { turnSeconds: 30 });
    await until(() => board.view() !== null, 'first board snapshot');
    const version = board.view()!.version;
    const onlineOf = (id: string) => board.view()!.players.find((p) => p.id === id)?.online;
    expect(onlineOf(bob!.playerId)).toBe(true);

    bob!.socket.disconnect();
    await until(() => onlineOf(bob!.playerId) === false, 'Bob shown offline');
    expect(board.view()!.version).toBe(version);

    // Ten seconds pass while Bob is away; the phone that comes back gets the clock as it is now.
    clock.advance(10_000);
    const back = open({ role: 'player', sessionToken: bob!.token });
    let returned: PlayerView | null = null;
    back.on('game:state', (view) => (returned = view));
    await until(() => returned !== null, 'Bob gets a snapshot');

    expect(returned!.version).toBe(version);
    expect(returned!.turn?.remainingMs).toBe(20_000);
    await until(() => onlineOf(bob!.playerId) === true, 'Bob shown online again');
    expect(ann!.view?.version).toBe(version);
  });
});

describe('racing commands', () => {
  it('lets exactly one of two simultaneous host:start commands win', async () => {
    const board = openBoard();
    await seat(board.socket, ['Ann', 'Bob']);
    const second = open({ role: 'board' });

    const acks = await Promise.all([
      send(board.socket, 'host:start', {}),
      send(second, 'host:start', {}),
    ]);

    expect(acks.filter((ack) => ack.ok)).toHaveLength(1);
    expect(acks.filter((ack) => !ack.ok)).toEqual([{ ok: false, error: 'GAME_IN_PROGRESS' }]);
    expect(server.room.phase).toBe('playing');
  });

  it('lets exactly one of two simultaneous attacks open the bout, the other is a legal throw-in or refused', async () => {
    const board = openBoard();
    const phones = await seat(board.socket, ['Ann', 'Bob']);
    await send(board.socket, 'host:start', {});
    await until(() => phones.every((p) => p.view !== null), 'hands dealt');

    const attacker = phones.find((p) => p.view!.bout.attackerId === p.playerId)!;
    const defender = phones.find((p) => p !== attacker)!;
    const [first, second] = attacker.view!.me.hand;

    // The defender cannot attack; the attacker's two cards race: the second one must
    // match the rank of the first, otherwise it is refused. Either way the table never
    // gets more cards than the rules allow, and the defender's attempt never goes through.
    const [fromDefender, a, b] = await Promise.all([
      send(defender.socket, 'game:attack', { cardId: defender.view!.me.hand[0]!.id }),
      send(attacker.socket, 'game:attack', { cardId: first!.id }),
      send(attacker.socket, 'game:attack', { cardId: second!.id }),
    ]);

    expect(fromDefender).toEqual({ ok: false, error: 'NOT_YOUR_TURN' });
    expect(a).toEqual({ ok: true, data: {} });
    expect(b.ok || (b as { error: string }).error === 'RANK_NOT_ON_TABLE').toBe(true);
    expect(server.room.game!.table.length).toBe(b.ok ? 2 : 1);
  });
});
