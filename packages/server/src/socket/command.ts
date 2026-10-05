import { ackError } from '@durak/shared';
import type { Ack, ClientToServerEvents } from '@durak/shared';
import type { z } from 'zod';
import { logger } from '../logger.js';
import { COMMANDS_PER_SECOND, COMMAND_BURST, RateLimiter } from './rateLimit.js';
import type { GameSocket } from './types.js';

/** One bucket per connection, shared by all of its commands. */
const limiters = new WeakMap<GameSocket, RateLimiter>();

export interface CommandLimits {
  readonly burst: number;
  readonly perSecond: number;
}

export const DEFAULT_COMMAND_LIMITS: CommandLimits = {
  burst: COMMAND_BURST,
  perSecond: COMMANDS_PER_SECOND,
};

/** Gives a freshly connected socket its bucket. Call once per connection. */
export function limitCommands(socket: GameSocket, limits: CommandLimits): void {
  limiters.set(socket, new RateLimiter(limits.burst, limits.perSecond));
}

function limiterOf(socket: GameSocket): RateLimiter {
  let limiter = limiters.get(socket);
  if (!limiter) {
    limitCommands(socket, DEFAULT_COMMAND_LIMITS);
    limiter = limiters.get(socket)!;
  }
  return limiter;
}

type CommandName = keyof ClientToServerEvents;
type PayloadOf<E extends CommandName> = Parameters<ClientToServerEvents[E]>[0];
type AckDataOf<E extends CommandName> = Parameters<ClientToServerEvents[E]>[1] extends (
  response: Ack<infer T>,
) => void
  ? T
  : never;

/**
 * Registers a client → server command with the cross-cutting concerns applied
 * once, in one place (DRY):
 *   0. a per-connection rate limit, checked before anything else is looked at,
 *   1. runtime validation of the untrusted payload (zod),
 *   2. a guaranteed ack — every command gets exactly one response,
 *   3. unexpected exceptions are logged and turned into an INTERNAL error
 *      instead of crashing the process or leaving the client hanging.
 *
 * Handlers must stay synchronous: no `await` between reading and writing room
 * state keeps concurrent commands strictly first-come-first-served.
 */
export function onCommand<E extends CommandName>(
  socket: GameSocket,
  event: E,
  schema: z.ZodType<PayloadOf<E>>,
  handler: (payload: PayloadOf<E>) => Ack<AckDataOf<E>>,
): void {
  const listener = (payload: unknown, ack: unknown): void => {
    const reply = typeof ack === 'function' ? (ack as (response: Ack<AckDataOf<E>>) => void) : null;
    if (!reply) {
      logger.warn('command without ack ignored', { event, socketId: socket.id });
      return;
    }

    if (!limiterOf(socket).tryTake()) {
      logger.warn('command rate limited', { event, socketId: socket.id });
      reply(ackError('RATE_LIMITED'));
      return;
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      reply(ackError('VALIDATION'));
      return;
    }

    try {
      reply(handler(parsed.data));
    } catch (error) {
      logger.error('command failed', { event, socketId: socket.id, error });
      reply(ackError('INTERNAL'));
    }
  };

  // The listener accepts `unknown` on purpose (validated above); Socket.IO's
  // generic overloads cannot express that for a generic event name.
  socket.on(event, listener as never);
}
