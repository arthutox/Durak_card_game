import { useState } from 'react';
import { ConnectionBadge } from '../../components/ConnectionBadge';
import { useGameStore } from '../../store/gameStore';
import { useRoomStore } from '../../store/roomStore';
import { BoardLobby } from './BoardLobby';
import { BoutBanner } from './BoutBanner';
import { GameTable } from './GameTable';
import { Results } from './Results';
import { sendHostCommand, useBoardSession } from './boardSession';

/**
 * Laptop screen: the shared table everyone looks at. Lobby while seats fill
 * up, then the game table; results and host buttons appear when it ends.
 */
export function HostBoard() {
  useBoardSession();
  const connection = useRoomStore((s) => s.connection);
  const room = useRoomStore((s) => s.room);
  const game = useGameStore((s) => s.game);
  const [confirmAbort, setConfirmAbort] = useState(false);

  const inGame = room?.phase !== 'lobby' && game !== null;

  return (
    <main className="board">
      <header className="board-header">
        <h1>Durak</h1>
        <div className="header-actions">
          {inGame && room?.phase === 'playing' && (
            <button
              className="button button-small"
              onClick={() => {
                if (!confirmAbort) return setConfirmAbort(true);
                setConfirmAbort(false);
                void sendHostCommand('host:abort');
              }}
              onBlur={() => setConfirmAbort(false)}
            >
              {confirmAbort ? 'Really end the game?' : 'End game'}
            </button>
          )}
          <ConnectionBadge status={connection} />
        </div>
      </header>

      {connection === 'offline' && room === null ? (
        <p className="notice">
          The table screen only connects from this laptop (localhost). Make sure the server is
          running.
        </p>
      ) : inGame ? (
        <>
          <GameTable game={game} />
          <BoutBanner />
          <Results game={game} />
        </>
      ) : (
        <BoardLobby />
      )}
    </main>
  );
}
