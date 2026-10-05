import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import type { ServerConfig } from './config.js';
import { serveClient } from './http/static.js';
import { realScheduler } from './game/TurnTimer.js';
import type { Scheduler } from './game/TurnTimer.js';
import { Room } from './room/Room.js';
import { authenticate } from './socket/auth.js';
import { registerBoardHandlers } from './socket/boardHandlers.js';
import { createBroadcaster } from './socket/broadcaster.js';
import { createGameFlow } from './socket/gameFlow.js';
import type { GameFlow } from './socket/gameFlow.js';
import { registerPlayerHandlers } from './socket/playerHandlers.js';
import type { GameServer } from './socket/types.js';

export interface GameServerInstance {
  readonly httpServer: HttpServer;
  readonly io: GameServer;
  readonly room: Room;
  readonly flow: GameFlow;
}

/** Time sources for the turn timer; tests inject a manual clock. */
export interface GameServerClock {
  readonly now: () => number;
  readonly scheduler: Scheduler;
}

/**
 * Composition root: builds the object graph without starting to listen, so
 * integration tests can create an isolated server on a random port.
 */
export function createGameServer(
  config: ServerConfig,
  joinUrl: string,
  clock: GameServerClock = { now: Date.now, scheduler: realScheduler },
): GameServerInstance {
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

  const room = new Room({ generateId: randomUUID, joinUrl, now: clock.now });
  const broadcast = createBroadcaster(io, room);
  const flow = createGameFlow({ room, broadcast, scheduler: clock.scheduler });

  io.use(authenticate);
  io.on('connection', (socket) => {
    if (socket.data.role === 'board') registerBoardHandlers(socket, { io, room, broadcast, flow });
    else registerPlayerHandlers(socket, { io, room, broadcast, flow });
  });

  return { httpServer, io, room, flow };
}
