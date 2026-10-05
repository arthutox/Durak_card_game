/**
 * Phone-side session: one socket per page plus the lobby commands.
 * Components call these functions; they never touch the socket directly.
 */
import { useEffect } from 'react';
import { PLAYER_COLORS } from '@durak/shared';
import type { Card, CardId, JoinResult, PlayerColor, PlayerView } from '@durak/shared';
import { ACK_TIMEOUT_MS, awaitAck, awaitOutcome, createSocket } from '../../socket/socket';
import type { CommandOutcome } from '../../socket/socket';
import { useRoomSync } from '../../socket/useRoomSync';
import { useHandStore } from '../../store/handStore';
import { useRoomStore } from '../../store/roomStore';
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

    const onGameState = (view: PlayerView) => useHandStore.getState().setView(view);

    playerSocket.on('session:restored', onRestored);
    playerSocket.on('session:invalid', onInvalid);
    playerSocket.on('session:kicked', onInvalid);
    playerSocket.on('game:state', onGameState);

    // A new phase (lobby, new game, results) starts clean: this also lets a
    // rematch, whose version restarts at 0, through the version check.
    let phase = useRoomStore.getState().room?.phase;
    const unsubscribe = useRoomStore.subscribe((state) => {
      if (state.room && state.room.phase !== phase) {
        phase = state.room.phase;
        useHandStore.getState().clearView();
      }
    });

    return () => {
      playerSocket.off('session:restored', onRestored);
      playerSocket.off('session:invalid', onInvalid);
      playerSocket.off('session:kicked', onInvalid);
      playerSocket.off('game:state', onGameState);
      unsubscribe();
    };
  }, []);
}

export async function joinLobby(nickname: string, color: PlayerColor): Promise<CommandOutcome> {
  const ack = await awaitAck<JoinResult>(
    playerSocket.timeout(ACK_TIMEOUT_MS).emitWithAck('lobby:join', { nickname, color }),
  );
  if (!ack.ok) return ack.error;

  tokenStorage.write(ack.data.sessionToken);
  useSessionStore.getState().setPlayerId(ack.data.playerId);
  return null;
}

export async function leaveLobby(): Promise<CommandOutcome> {
  const ack = await awaitAck(playerSocket.timeout(ACK_TIMEOUT_MS).emitWithAck('lobby:leave', {}));
  if (!ack.ok) return ack.error;

  tokenStorage.clear();
  useSessionStore.getState().setPlayerId(null);
  return null;
}

/** First palette color nobody has taken yet. */
export function firstFreeColor(taken: readonly PlayerColor[]): PlayerColor | null {
  return PLAYER_COLORS.find((color) => !taken.includes(color)) ?? null;
}

type GameCommand =
  | { readonly kind: 'attack'; readonly cardId: CardId }
  | { readonly kind: 'defend'; readonly cardId: CardId; readonly targetAttackIndex: number }
  | { readonly kind: 'pass' }
  | { readonly kind: 'take' };

function emitGameCommand(command: GameCommand): Promise<CommandOutcome> {
  const socket = playerSocket.timeout(ACK_TIMEOUT_MS);
  switch (command.kind) {
    case 'attack':
      return awaitOutcome(socket.emitWithAck('game:attack', { cardId: command.cardId }));
    case 'defend':
      return awaitOutcome(
        socket.emitWithAck('game:defend', {
          cardId: command.cardId,
          targetAttackIndex: command.targetAttackIndex,
        }),
      );
    case 'pass':
      return awaitOutcome(socket.emitWithAck('game:pass', {}));
    case 'take':
      return awaitOutcome(socket.emitWithAck('game:take', {}));
  }
}

/**
 * Sends a move. A card move is applied optimistically (the card leaves the
 * hand and sticks to its target); an error rolls it back with a toast. On
 * success the snapshot has already arrived (the server emits it before the
 * ack, on the same socket), so clearing the pending move is seamless.
 */
export async function playMove(command: GameCommand, card?: Card): Promise<void> {
  const { setPending, showToast } = useHandStore.getState();
  if (card) {
    setPending({ card, targetIndex: command.kind === 'defend' ? command.targetAttackIndex : null });
  }
  const outcome = await emitGameCommand(command);
  setPending(null);
  if (outcome) showToast(outcome);
}
