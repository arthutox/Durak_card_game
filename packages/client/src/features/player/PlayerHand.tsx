import { ConnectionBadge } from '../../components/ConnectionBadge';
import { useRoomStore } from '../../store/roomStore';
import { useSessionStore } from '../../store/sessionStore';
import { JoinForm } from './JoinForm';
import { usePlayerSession } from './playerSession';
import { WaitingRoom } from './WaitingRoom';

/**
 * Phone screen: the player's "hand".
 * Current scope (sprint 0): join form → waiting room. The cards with
 * drag-and-drop arrive in sprint 6.
 */
export function PlayerHand() {
  usePlayerSession();
  const connection = useRoomStore((s) => s.connection);
  const room = useRoomStore((s) => s.room);
  const playerId = useSessionStore((s) => s.playerId);

  // Seated only if the server's snapshot agrees (the seat may have been freed).
  const meId = playerId !== null && room?.players.some((p) => p.id === playerId) ? playerId : null;

  return (
    <main className="hand">
      <header className="hand-header">
        <h1>Durak</h1>
        <ConnectionBadge status={connection} />
      </header>

      {room === null ? (
        <p className="muted">Connecting to the table…</p>
      ) : meId !== null ? (
        <WaitingRoom room={room} meId={meId} />
      ) : room.phase !== 'lobby' ? (
        <p className="notice">A game is in progress. Please wait until it ends.</p>
      ) : (
        <JoinForm room={room} />
      )}
    </main>
  );
}
