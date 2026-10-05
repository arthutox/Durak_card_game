import type { PublicView } from '@durak/shared';
import { URGENT_SECONDS } from '../../components/useCountdown';

/** Big countdown under the table: who the game is waiting for and how long is left. */
export function TurnClockBar({ game, seconds }: { game: PublicView; seconds: number | null }) {
  const { turn } = game;
  if (!turn || seconds === null || game.outcome) return null;

  const names = turn.onClock
    .map((id) => game.players.find((p) => p.id === id)?.nickname)
    .filter((name): name is string => Boolean(name));
  const durationSeconds = turn.durationMs / 1000;
  const urgent = seconds <= URGENT_SECONDS;

  return (
    <div className={`turn-bar${urgent ? ' is-urgent' : ''}`}>
      <div className="turn-bar-head">
        <span className="muted">{names.length > 0 ? `${names.join(', ')} on the clock` : ''}</span>
        <span className="turn-bar-seconds" role="timer" aria-label={`${seconds} seconds left`}>
          {seconds} s
        </span>
      </div>
      <div className="turn-bar-track">
        <div
          className="turn-bar-fill"
          style={{ width: `${Math.min(100, (seconds / durationSeconds) * 100)}%` }}
        />
      </div>
    </div>
  );
}
