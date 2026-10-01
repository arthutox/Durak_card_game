import { QRCodeSVG } from 'qrcode.react';
import { MAX_PLAYERS, MIN_PLAYERS } from '@durak/shared';
import { ConnectionBadge } from '../../components/ConnectionBadge';
import { PlayerList } from '../../components/PlayerList';
import { useRoomStore } from '../../store/roomStore';
import { useBoardSession } from './boardSession';

/**
 * Laptop screen: the shared table everyone looks at.
 * Current scope (sprint 0): lobby — QR code to join and the list of seats.
 * The game table (deck, trump, bouts, discard) arrives in sprint 5.
 */
export function HostBoard() {
  useBoardSession();
  const connection = useRoomStore((s) => s.connection);
  const room = useRoomStore((s) => s.room);

  const players = room?.players ?? [];
  const allOnline = players.every((p) => p.online);
  const canStart = players.length >= MIN_PLAYERS && allOnline;

  return (
    <main className="board">
      <header className="board-header">
        <h1>Durak</h1>
        <ConnectionBadge status={connection} />
      </header>

      {connection === 'offline' && room === null ? (
        <p className="notice">
          The table screen only connects from this laptop (localhost). Make sure the server is
          running.
        </p>
      ) : (
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
            <button
              className="button button-primary"
              disabled
              title="Starting a game arrives in sprint 2"
            >
              Start game
            </button>
            <p className="muted small">
              {canStart
                ? 'Everyone is here. Starting a game arrives in the next sprints.'
                : `At least ${MIN_PLAYERS} players are needed, all online.`}
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
