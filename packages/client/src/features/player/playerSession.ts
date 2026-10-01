/**
 * Phone-side session: one socket per page plus the lobby commands.
 * Components call these functions; they never touch the socket directly.
 */
import { useEffect } from 'react';
import { PLAYER_COLORS } from '@durak/shared';
import type { ErrorCode, PlayerColor } from '@durak/shared';
import { ACK_TIMEOUT_MS, createSocket } from '../../socket/socket';
import { useRoomSync } from '../../socket/useRoomSync';
import { tokenStorage, useSessionStore } from '../../store/sessionStore';

export const playerSocket = createSocket(() => {
  const sessionToken = tokenStorage.read();
  return sessionToken ? { role: 'player', sessionToken } : { role: 'player' };
});

/** Keeps the phone connected and its seat in sync with the server. */
export function usePlayerSession(): void {
  useRoomSync(playerSocket);

  useEffect(() => {
    const { setPlayerId } = useSessionStore.getState();
    const onRestored = ({ playerId }: { playerId: string }) => setPlayerId(playerId);
    const onInvalid = () => {
      tokenStorage.clear();
      setPlayerId(null);
    };

    playerSocket.on('session:restored', onRestored);
    playerSocket.on('session:invalid', onInvalid);
    return () => {
      playerSocket.off('session:restored', onRestored);
      playerSocket.off('session:invalid', onInvalid);
    };
  }, []);
}

/** null = success; otherwise the error code to show. */
export type CommandOutcome = ErrorCode | null;

export async function joinLobby(nickname: string, color: PlayerColor): Promise<CommandOutcome> {
  try {
    const ack = await playerSocket
      .timeout(ACK_TIMEOUT_MS)
      .emitWithAck('lobby:join', { nickname, color });
    if (!ack.ok) return ack.error;

    tokenStorage.write(ack.data.sessionToken);
    useSessionStore.getState().setPlayerId(ack.data.playerId);
    return null;
  } catch {
    return 'INTERNAL'; // ack timeout: server unreachable
  }
}

export async function leaveLobby(): Promise<CommandOutcome> {
  try {
    const ack = await playerSocket.timeout(ACK_TIMEOUT_MS).emitWithAck('lobby:leave', {});
    if (!ack.ok) return ack.error;

    tokenStorage.clear();
    useSessionStore.getState().setPlayerId(null);
    return null;
  } catch {
    return 'INTERNAL';
  }
}

/** First palette color nobody has taken yet. */
export function firstFreeColor(taken: readonly PlayerColor[]): PlayerColor | null {
  return PLAYER_COLORS.find((color) => !taken.includes(color)) ?? null;
}
