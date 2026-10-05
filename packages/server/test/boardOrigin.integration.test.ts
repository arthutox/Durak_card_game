/** The board role over real sockets: loopback is not enough, the page's origin must be local too. */
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { createGameServer } from '../src/createGameServer.js';
import type { GameServerInstance } from '../src/createGameServer.js';

let server: GameServerInstance;
let url: string;
const sockets: Socket[] = [];

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

/** Resolves with 'connected' or the `connect_error` message. */
function openBoard(origin?: string): Promise<string> {
  const socket = connect(url, {
    auth: { role: 'board' },
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    ...(origin ? { extraHeaders: { origin } } : {}),
  });
  sockets.push(socket);
  return new Promise((resolve) => {
    socket.on('connect', () => resolve('connected'));
    socket.on('connect_error', (error) => resolve(error.message));
  });
}

describe('board handshake origin', () => {
  it('accepts a non-browser client (no Origin header)', async () => {
    expect(await openBoard()).toBe('connected');
  });

  it('accepts the board page served from localhost', async () => {
    expect(await openBoard('http://localhost:5173')).toBe('connected');
  });

  it('rejects a page from another site even though the connection is from loopback', async () => {
    expect(await openBoard('https://evil.example')).toBe('FORBIDDEN');
  });

  it('rejects the LAN address as an origin', async () => {
    expect(await openBoard('http://192.168.0.189:5173')).toBe('FORBIDDEN');
  });
});
