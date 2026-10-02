import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import type { ServerConfig } from './config.js';
import { serveClient } from './http/static.js';
import { Room } from './room/Room.js';
import { authenticate } from './socket/auth.js';
import { registerBoardHandlers } from './socket/boardHandlers.js';
import { createBroadcaster } from './socket/broadcaster.js';
import { registerPlayerHandlers } from './socket/playerHandlers.js';
import type { GameServer } from './socket/types.js';

export interface GameServerInstance {
  readonly httpServer: HttpServer;
  readonly io: GameServer;
  readonly room: Room;
}

/**
 * Composition root: builds the object graph without starting to listen, so
 * integration tests can create an isolated server on a random port.
 */
export function createGameServer(config: ServerConfig, joinUrl: string): GameServerInstance {
  const app = express();
  app.disable('x-powered-by');
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  if (config.isProduction) serveClient(app, config.clientDistDir);

  const httpServer = createServer(app);
  // In dev the page comes from Vite (another port), so allow cross-origin;
  // in production Express serves the page and everything is same-origin.
  const io: GameServer = new Server(
    httpServer,
    config.isProduction ? {} : { cors: { origin: true } },
  );

  const room = new Room({ generateId: randomUUID, joinUrl });
  const broadcast = createBroadcaster(io, room);

  io.use(authenticate);
  io.on('connection', (socket) => {
    if (socket.data.role === 'board') registerBoardHandlers(socket, { room, broadcast });
    else registerPlayerHandlers(socket, { io, room, broadcast });
  });

  return { httpServer, io, room };
}
