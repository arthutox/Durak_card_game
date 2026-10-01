import { handshakeAuthSchema } from '@durak/shared';
import type { HandshakeAuth } from '@durak/shared';
import { logger } from '../logger.js';
import type { GameSocket } from './types.js';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/** Is the remote address this machine itself? */
export function isLoopback(address: string): boolean {
  return LOOPBACK.has(address);
}

/** Error passed to `next()` — the client receives it as `connect_error` with `.message`. */
function rejection(code: 'VALIDATION' | 'FORBIDDEN'): Error {
  return new Error(code);
}

/**
 * Socket.IO middleware: validates the handshake and assigns the role.
 * The board role is allowed only from the laptop itself (loopback), so a
 * phone on the LAN cannot open the host screen and press "Start".
 */
export function authenticate(socket: GameSocket, next: (error?: Error) => void): void {
  const parsed = handshakeAuthSchema.safeParse(socket.handshake.auth);
  if (!parsed.success) {
    next(rejection('VALIDATION'));
    return;
  }

  const auth: HandshakeAuth = parsed.data;
  if (auth.role === 'board' && !isLoopback(socket.handshake.address)) {
    logger.warn('board connection rejected: not loopback', { address: socket.handshake.address });
    next(rejection('FORBIDDEN'));
    return;
  }

  socket.data.role = auth.role;
  socket.data.playerId = null;
  next();
}

/** Session token from the (already validated) handshake, if the phone sent one. */
export function handshakeSessionToken(socket: GameSocket): string | undefined {
  const parsed = handshakeAuthSchema.safeParse(socket.handshake.auth);
  return parsed.success && parsed.data.role === 'player' ? parsed.data.sessionToken : undefined;
}
