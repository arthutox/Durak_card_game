import { useState } from 'react';
import { ERROR_MESSAGES } from '@durak/shared';
import type { PublicView } from '@durak/shared';
import { sendHostCommand } from './boardSession';
import type { HostCommand } from './boardSession';

/** End-of-game overlay with the host's follow-up buttons. */
export function Results({ game }: { game: PublicView }) {
  const [error, setError] = useState<string | null>(null);
  const { outcome } = game;
  if (!outcome) return null;

  const loser =
    outcome.type === 'loser' ? game.players.find((p) => p.id === outcome.playerId) : undefined;

  const run = async (command: HostCommand) => {
    const result = await sendHostCommand(command);
    setError(result ? ERROR_MESSAGES[result] : null);
  };

  return (
    <div className="overlay" role="dialog" aria-label="Game over">
      <div className="panel results">
        <h2>Game over</h2>
        <p className="results-line">
          {loser ? (
            <>
              <strong>{loser.nickname}</strong> is the Durak 🤡
            </>
          ) : (
            "It's a draw — nobody is the Durak"
          )}
        </p>
        <button className="button button-primary" onClick={() => void run('host:rematch')}>
          Play again
        </button>
        <button className="button" onClick={() => void run('host:toLobby')}>
          Back to lobby
        </button>
        {error && <p className="form-error">{error}</p>}
      </div>
    </div>
  );
}
