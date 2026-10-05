import { useEffect } from 'react';
import type { ErrorCode, PublicView, TurnSeconds } from '@durak/shared';
import { ACK_TIMEOUT_MS, createSocket } from '../../socket/socket';
import { useRoomSync } from '../../socket/useRoomSync';
import { useGameStore } from '../../store/gameStore';
import { useRoomStore } from '../../store/roomStore';

/** The host screen connects with the board role (accepted from localhost only). */
export const boardSocket = createSocket(() => ({ role: 'board' }));

export function useBoardSession(): void {
  useRoomSync(boardSocket);

  useEffect(() => {
    const { setGame, showBanner } = useGameStore.getState();
    const onState = (view: PublicView) => setGame(view);
    const onBanner = ({ playerId }: { playerId: string }) => showBanner(playerId);
    boardSocket.on('board:state', onState);
    boardSocket.on('board:banner', onBanner);

    // A new phase (lobby, new game, results) starts from a clean slate: this
    // also lets a rematch, whose version restarts at 0, through the version check.
    let phase = useRoomStore.getState().room?.phase;
    const unsubscribe = useRoomStore.subscribe((state) => {
      if (state.room && state.room.phase !== phase) {
        phase = state.room.phase;
        useGameStore.getState().clearGame();
      }
    });

    return () => {
      boardSocket.off('board:state', onState);
      boardSocket.off('board:banner', onBanner);
      unsubscribe();
    };
  }, []);
}

/** null = success; otherwise the error code to show. */
export type CommandOutcome = ErrorCode | null;

export type HostCommand = 'host:start' | 'host:abort' | 'host:rematch' | 'host:toLobby';

/** Removes a seat from the lobby (e.g. a phone that went away). */
export async function kickPlayer(playerId: string): Promise<CommandOutcome> {
  try {
    const ack = await boardSocket.timeout(ACK_TIMEOUT_MS).emitWithAck('host:kick', { playerId });
    return ack.ok ? null : ack.error;
  } catch {
    return 'INTERNAL';
  }
}

export async function sendHostCommand(
  command: HostCommand,
  options: { turnSeconds?: TurnSeconds | null } = {},
): Promise<CommandOutcome> {
  try {
    const socket = boardSocket.timeout(ACK_TIMEOUT_MS);
    const ack =
      command === 'host:start'
        ? await socket.emitWithAck(command, { turnSeconds: options.turnSeconds ?? null })
        : await socket.emitWithAck(command, {});
    return ack.ok ? null : ack.error;
  } catch {
    return 'INTERNAL'; // ack timeout: server unreachable
  }
}
