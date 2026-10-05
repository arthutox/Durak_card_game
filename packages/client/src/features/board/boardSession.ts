import { useEffect } from 'react';
import type { PublicView, TurnSeconds } from '@durak/shared';
import { ACK_TIMEOUT_MS, awaitOutcome, createSocket } from '../../socket/socket';
import type { CommandOutcome } from '../../socket/socket';
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

export type HostCommand = 'host:start' | 'host:abort' | 'host:rematch' | 'host:toLobby';

/** Removes a seat from the lobby (e.g. a phone that went away). */
export function kickPlayer(playerId: string): Promise<CommandOutcome> {
  return awaitOutcome(boardSocket.timeout(ACK_TIMEOUT_MS).emitWithAck('host:kick', { playerId }));
}

export function sendHostCommand(
  command: HostCommand,
  options: { turnSeconds?: TurnSeconds | null } = {},
): Promise<CommandOutcome> {
  const socket = boardSocket.timeout(ACK_TIMEOUT_MS);
  return awaitOutcome(
    command === 'host:start'
      ? socket.emitWithAck(command, { turnSeconds: options.turnSeconds ?? null })
      : socket.emitWithAck(command, {}),
  );
}
