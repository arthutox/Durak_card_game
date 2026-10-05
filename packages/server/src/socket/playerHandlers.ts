import {
  ackError,
  ackOk,
  attackPayloadSchema,
  defendPayloadSchema,
  emptyPayloadSchema,
  joinPayloadSchema,
} from '@durak/shared';
import type { Action, Ack, EmptyPayload } from '@durak/shared';
import { logger } from '../logger.js';
import type { Room } from '../room/Room.js';
import { handshakeSessionToken } from './auth.js';
import type { Broadcaster } from './broadcaster.js';
import { onCommand } from './command.js';
import type { GameFlow } from './gameFlow.js';
import { CHANNELS } from './types.js';
import type { GameServer, GameSocket } from './types.js';

interface Context {
  readonly io: GameServer;
  readonly room: Room;
  readonly broadcast: Broadcaster;
  readonly flow: GameFlow;
}

/** Wires one phone socket: session restore, lobby commands, disconnect. */
export function registerPlayerHandlers(
  socket: GameSocket,
  { io, room, broadcast, flow }: Context,
): void {
  restoreSession(socket, { io, room, broadcast });
  socket.emit('room:state', room.toView());

  /** Runs a game move for this socket's player and fans out the result. */
  const play = (action: Action): Ack<EmptyPayload> => {
    const { playerId } = socket.data;
    if (!playerId) return ackError('NOT_JOINED');

    const result = room.act(playerId, action);
    if (!result.ok) {
      if (result.error === 'CANNOT_BEAT') broadcast.cannotBeat(playerId);
      return ackError(result.error);
    }

    flow.moved(result.value.events);
    return ackOk({});
  };

  onCommand(socket, 'game:attack', attackPayloadSchema, ({ cardId }) =>
    play({ type: 'attack', cardId }),
  );
  onCommand(socket, 'game:defend', defendPayloadSchema, ({ cardId, targetAttackIndex }) =>
    play({ type: 'defend', cardId, targetAttackIndex }),
  );
  onCommand(socket, 'game:pass', emptyPayloadSchema, () => play({ type: 'pass' }));
  onCommand(socket, 'game:take', emptyPayloadSchema, () => play({ type: 'take' }));

  onCommand(socket, 'lobby:join', joinPayloadSchema, (payload) => {
    if (socket.data.playerId) return ackError('ALREADY_JOINED');

    const result = room.join(socket.id, payload);
    if (!result.ok) return ackError(result.error);

    const seat = result.value;
    socket.data.playerId = seat.playerId;
    void socket.join(CHANNELS.players);
    logger.info('player joined', { playerId: seat.playerId, nickname: seat.nickname });
    broadcast.roomState();
    return ackOk({ playerId: seat.playerId, sessionToken: seat.sessionToken });
  });

  onCommand(socket, 'lobby:leave', emptyPayloadSchema, () => {
    const { playerId } = socket.data;
    if (!playerId) return ackError('NOT_JOINED');

    const result = room.leave(playerId);
    if (!result.ok) return ackError(result.error);

    socket.data.playerId = null;
    void socket.leave(CHANNELS.players);
    logger.info('player left', { playerId });
    broadcast.roomState();
    return ackOk({});
  });

  socket.on('disconnect', () => {
    const seat = room.disconnect(socket.id);
    if (seat) {
      logger.info('player offline', { playerId: seat.playerId });
      broadcast.roomState();
      broadcast.gameState();
    }
  });
}

/**
 * A phone that reconnects sends its session token in the handshake and gets
 * its seat back. An older socket holding the same seat (second tab, half-dead
 * connection) is disconnected: newest connection wins.
 */
function restoreSession(socket: GameSocket, { io, room, broadcast }: Omit<Context, 'flow'>): void {
  const token = handshakeSessionToken(socket);
  if (!token) return;

  const resumed = room.resume(token, socket.id);
  if (!resumed) {
    socket.emit('session:invalid');
    return;
  }

  const { seat, replacedSocketId } = resumed;
  socket.data.playerId = seat.playerId;
  void socket.join(CHANNELS.players);
  if (replacedSocketId) io.sockets.sockets.get(replacedSocketId)?.disconnect(true);

  socket.emit('session:restored', { playerId: seat.playerId });
  logger.info('player reconnected', { playerId: seat.playerId });
  broadcast.roomState();
  broadcast.gameState();
}
