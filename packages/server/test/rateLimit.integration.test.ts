/** A flood of commands over a real socket is refused, a normal player is not. */
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { Ack, ClientToServerEvents, ServerToClientEvents } from '@durak/shared';
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

function open(auth: Record<string, unknown>): Promise<ClientSocket> {
  const socket: ClientSocket = connect(url, { auth, transports: ['websocket'], forceNew: true });
  sockets.push(socket);
  return new Promise((resolve) => socket.on('connect', () => resolve(socket)));
}

function send(socket: ClientSocket, event: string, payload: unknown): Promise<Ack<unknown>> {
  return new Promise((resolve) => {
    (socket.emit as (...args: unknown[]) => void)(event, payload, resolve);
  });
}

describe('command rate limit', () => {
  it('refuses most of a 200-command flood with RATE_LIMITED', async () => {
    const phone = await open({ role: 'player' });

    const acks = await Promise.all(Array.from({ length: 200 }, () => send(phone, 'game:pass', {})));

    const limited = acks.filter((ack) => !ack.ok && ack.error === 'RATE_LIMITED');
    const answered = acks.filter((ack) => !ack.ok && ack.error === 'NOT_JOINED');
    expect(limited.length).toBeGreaterThan(150);
    expect(answered.length).toBeGreaterThanOrEqual(15);
  });

  it("one client's flood does not slow down another", async () => {
    const flooder = await open({ role: 'player' });
    const other = await open({ role: 'player' });
    await Promise.all(Array.from({ length: 100 }, () => send(flooder, 'game:pass', {})));

    expect(await send(other, 'game:pass', {})).toEqual({ ok: false, error: 'NOT_JOINED' });
  });

  it('drops an oversized message instead of processing it', async () => {
    const phone = await open({ role: 'player' });
    const closed = new Promise<void>((resolve) => phone.on('disconnect', () => resolve()));

    phone.emit('lobby:join', { nickname: 'x'.repeat(50_000), color: 'red' }, () => undefined);

    await closed;
    expect(server.room.seats).toHaveLength(0);
  });
});
