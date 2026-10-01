import type { LobbyPlayerView, PlayerId } from '@durak/shared';
import { PLAYER_COLOR_HEX } from './playerColors';

interface PlayerListProps {
  players: readonly LobbyPlayerView[];
  /** Highlights the viewer's own row on the phone. */
  meId?: PlayerId | null;
}

/** Seat order = clockwise order at the table, so the list is numbered. */
export function PlayerList({ players, meId = null }: PlayerListProps) {
  if (players.length === 0) {
    return <p className="muted">Nobody yet. Scan the QR code to join.</p>;
  }

  return (
    <ol className="player-list">
      {players.map((player, index) => (
        <li
          key={player.id}
          className={`player-row${player.online ? '' : ' is-offline'}${player.id === meId ? ' is-me' : ''}`}
        >
          <span className="seat-number">{index + 1}</span>
          <span className="color-dot" style={{ background: PLAYER_COLOR_HEX[player.color] }} />
          <span className="nickname" style={{ color: PLAYER_COLOR_HEX[player.color] }}>
            {player.nickname}
          </span>
          {player.id === meId && <span className="badge">you</span>}
          {!player.online && <span className="badge badge-warn">offline</span>}
        </li>
      ))}
    </ol>
  );
}
