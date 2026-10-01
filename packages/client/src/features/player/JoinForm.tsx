import { useState } from 'react';
import type { FormEvent } from 'react';
import { NICKNAME_MAX_LENGTH, errorMessage } from '@durak/shared';
import type { ErrorCode, PlayerColor, RoomView } from '@durak/shared';
import { ColorPicker } from '../../components/ColorPicker';
import { firstFreeColor, joinLobby } from './playerSession';

export function JoinForm({ room }: { room: RoomView }) {
  const [nickname, setNickname] = useState('');
  const [picked, setPicked] = useState<PlayerColor | null>(null);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Someone may grab "my" color while I'm typing: fall back to a free one.
  const color =
    picked && !room.takenColors.includes(picked) ? picked : firstFreeColor(room.takenColors);
  const canSubmit = nickname.trim().length > 0 && color !== null && !submitting;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || !color) return;

    setSubmitting(true);
    setError(await joinLobby(nickname, color));
    setSubmitting(false);
  }

  return (
    <form className="panel join-form" onSubmit={handleSubmit}>
      <h2>Join the game</h2>

      <label className="field">
        <span>Nickname</span>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={NICKNAME_MAX_LENGTH}
          autoComplete="nickname"
          autoFocus
          placeholder="What should we call you?"
        />
      </label>

      <div className="field">
        <span>Name color</span>
        <ColorPicker value={color} taken={room.takenColors} onChange={setPicked} />
      </div>

      {error && (
        <p className="form-error" role="alert">
          {errorMessage(error)}
        </p>
      )}

      <button className="button button-primary" type="submit" disabled={!canSubmit}>
        {submitting ? 'Joining…' : 'Take a seat'}
      </button>
    </form>
  );
}
