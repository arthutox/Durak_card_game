import { ackError, ackOk, emptyPayloadSchema, startPayloadSchema } from '@durak/shared';
import type { Ack, EmptyPayload, ErrorCode, Result } from '@durak/shared';
import { logger } from '../logger.js';
import type { Room } from '../room/Room.js';
import type { Broadcaster } from './broadcaster.js';
import { onCommand } from './command.js';
import type { GameFlow } from './gameFlow.js';
import { CHANNELS } from './types.js';
import type { GameSocket } from './types.js';

interface Context {
  readonly room: Room;
  readonly broadcast: Broadcaster;
  readonly flow: GameFlow;
}

/**
 * Wires the host screen. On every (re)connect the board receives the current
 * snapshots; the `host:*` commands drive the room through its phases.
 */
export function registerBoardHandlers(
  socket: GameSocket,
  { room, broadcast, flow }: Context,
): void {
  void socket.join(CHANNELS.board);
  socket.emit('room:state', room.toView());
  broadcast.gameStateTo(socket);

  const hostCommand = (
    event: 'host:abort' | 'host:rematch' | 'host:toLobby',
    run: () => Result<unknown, ErrorCode>,
  ): void => {
    onCommand(socket, event, emptyPayloadSchema, (): Ack<EmptyPayload> => {
      const result = run();
      if (!result.ok) return ackError(result.error);
      logger.info('host command', { event });
      flow.changed();
      return ackOk({});
    });
  };

  onCommand(socket, 'host:start', startPayloadSchema, ({ turnSeconds }): Ack<EmptyPayload> => {
    const result = room.startGame({ turnSeconds });
    if (!result.ok) return ackError(result.error);
    logger.info('host command', { event: 'host:start', turnSeconds: turnSeconds ?? null });
    flow.changed();
    return ackOk({});
  });
  hostCommand('host:rematch', () => room.rematch());
  hostCommand('host:abort', () => room.abort());
  hostCommand('host:toLobby', () => room.toLobby());
}
