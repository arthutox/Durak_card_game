import { useState } from 'react';
import { errorMessage } from '@durak/shared';
import type { ErrorCode, PlayerId, RoomView } from '@durak/shared';
import { PlayerList } from '../../components/PlayerList';
import { leaveLobby } from './playerSession';

export function WaitingRoom({ room, meId }: { room: RoomView; meId: PlayerId }) {
  const [error, setError] = useState<ErrorCode | null>(null);

  return (
    <section className="panel">
      <h2>Waiting for the game to start</h2>
      <p className="muted">The host will start the game from the laptop screen.</p>
      <PlayerList players={room.players} meId={meId} />
      {error && (
        <p className="form-error" role="alert">
          {errorMessage(error)}
        </p>
      )}
      <button className="button" onClick={async () => setError(await leaveLobby())}>
        Leave the room
      </button>
    </section>
  );
}
