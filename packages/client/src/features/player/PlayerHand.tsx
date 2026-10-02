import { ConnectionBadge } from '../../components/ConnectionBadge';
import { useHandStore } from '../../store/handStore';
import { useRoomStore } from '../../store/roomStore';
import { useSessionStore } from '../../store/sessionStore';
import { JoinForm } from './JoinForm';
import { PlayerGame } from './PlayerGame';
import { usePlayerSession } from './playerSession';
import { WaitingRoom } from './WaitingRoom';

/**
 * Phone screen: the player's "hand".
 * Join form → waiting room → the game (hand, table, Pass / Take).
 */
export function PlayerHand() {
  usePlayerSession();
  const connection = useRoomStore((s) => s.connection);
  const room = useRoomStore((s) => s.room);
  const playerId = useSessionStore((s) => s.playerId);
  const view = useHandStore((s) => s.view);

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
      ) : meId !== null && room.phase !== 'lobby' && view !== null ? (
        <PlayerGame view={view} />
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
