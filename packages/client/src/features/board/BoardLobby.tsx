import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ERROR_MESSAGES, MAX_PLAYERS, MIN_PLAYERS } from '@durak/shared';
import { PlayerList } from '../../components/PlayerList';
import { useRoomStore } from '../../store/roomStore';
import { sendHostCommand } from './boardSession';

/** Lobby: QR code to join, the seats, and the Start button. */
export function BoardLobby() {
  const room = useRoomStore((s) => s.room);
  const [error, setError] = useState<string | null>(null);

  const players = room?.players ?? [];
  const canStart = players.length >= MIN_PLAYERS && players.every((p) => p.online);

  const start = async () => {
    const outcome = await sendHostCommand('host:start');
    setError(outcome ? ERROR_MESSAGES[outcome] : null);
  };

  return (
    <section className="board-lobby">
      <div className="panel join-panel">
        <h2>Join the game</h2>
        {room ? (
          <>
            <div className="qr">
              <QRCodeSVG value={room.joinUrl} size={240} marginSize={2} />
            </div>
            <p className="join-url">{room.joinUrl}</p>
            <p className="muted">Your phone must be on the same Wi-Fi network</p>
          </>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </div>

      <div className="panel">
        <h2>
          Players{' '}
          <span className="muted">
            {players.length}/{MAX_PLAYERS}
          </span>
        </h2>
        <PlayerList players={players} />
        <button className="button button-primary" disabled={!canStart} onClick={() => void start()}>
          Start game
        </button>
        {error && <p className="form-error">{error}</p>}
        {!canStart && (
          <p className="muted small">At least {MIN_PLAYERS} players are needed, all online.</p>
        )}
      </div>
    </section>
  );
}
