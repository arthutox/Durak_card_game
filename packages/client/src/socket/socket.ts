import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { ackError } from '@durak/shared';
import type {
  Ack,
  ClientToServerEvents,
  ErrorCode,
  HandshakeAuth,
  ServerToClientEvents,
} from '@durak/shared';

export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** How long a command waits for its ack before failing. */
export const ACK_TIMEOUT_MS = 5000;

/** null = success; otherwise the error code to show. */
export type CommandOutcome = ErrorCode | null;

/**
 * Awaits a command's ack. A missing one (timeout, dropped connection) is
 * reported as `NO_CONNECTION`, so it is not mistaken for a server-side error.
 */
export async function awaitAck<T>(pending: Promise<Ack<T>>): Promise<Ack<T>> {
  try {
    return await pending;
  } catch {
    return ackError('NO_CONNECTION');
  }
}

/** Like `awaitAck`, for commands whose reply carries nothing but success or an error. */
export async function awaitOutcome(pending: Promise<Ack<unknown>>): Promise<CommandOutcome> {
  const ack = await awaitAck(pending);
  return ack.ok ? null : ack.error;
}

/**
 * In development the page is served by Vite (:5173) and the game server runs
 * on :3000 of the same host, so connect there directly. Connecting directly
 * (instead of through Vite's proxy) keeps the real client address visible to
 * the server, which the board's localhost-only check relies on.
 * In production Express serves the page, so the same origin is used.
 */
function serverUrl(): string | null {
  if (!import.meta.env.DEV) return null;
  const port = (import.meta.env.VITE_SERVER_PORT as string | undefined) ?? '3000';
  return `${window.location.protocol}//${window.location.hostname}:${port}`;
}

/**
 * Creates a typed socket. `getAuth` is called on every (re)connect, so a
 * session token saved after joining is sent automatically on reconnects.
 */
export function createSocket(getAuth: () => HandshakeAuth): ClientSocket {
  const options = {
    autoConnect: false,
    transports: ['websocket'],
    auth: (send: (auth: HandshakeAuth) => void) => send(getAuth()),
  };
  const url = serverUrl();
  return url ? io(url, options) : io(options);
}
