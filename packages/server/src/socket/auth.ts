import { handshakeAuthSchema } from '@durak/shared';
import type { HandshakeAuth } from '@durak/shared';
import { logger } from '../logger.js';
import type { GameSocket } from './types.js';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/** Is the remote address this machine itself? */
export function isLoopback(address: string): boolean {
  return LOOPBACK.has(address);
}

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Browsers always send an `Origin` header on a WebSocket handshake, and a page
 * on another site cannot forge it. Without this check any web page the host
 * opens on the laptop could connect to ws://localhost as the board (the
 * connection itself comes from loopback) and end the game. A missing header
 * means a non-browser client, which cannot be driven by a web page.
 */
export function isTrustedBoardOrigin(origin: string | undefined): boolean {
  if (origin === undefined) return true;
  try {
    return LOOPBACK_HOSTNAMES.has(new URL(origin).hostname);
  } catch {
    return false; // "null" (sandboxed pages) and garbage
  }
}

/** Error passed to `next()` — the client receives it as `connect_error` with `.message`. */
function rejection(code: 'VALIDATION' | 'FORBIDDEN'): Error {
  return new Error(code);
}

/**
 * Socket.IO middleware: validates the handshake and assigns the role.
 * The board role is allowed only from the laptop itself (loopback) and only
 * from a page served from localhost, so neither a phone on the LAN nor a web
 * page on another site can open the host screen and press "Start".
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
  if (auth.role === 'board' && !isTrustedBoardOrigin(socket.handshake.headers.origin)) {
    logger.warn('board connection rejected: foreign origin', {
      origin: socket.handshake.headers.origin,
    });
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
