import type { PlayerView } from '@durak/shared';
import { canPass, canTake, needsAttention } from './handLogic';
import { playMove } from './playerSession';

/** Pass and Take; Pass pulses when the defender gave up and you may still throw in. */
export function ActionBar({ view }: { view: PlayerView }) {
  return (
    <div className="action-bar">
      <button
        className={`button${needsAttention(view) ? ' is-attention' : ''}`}
        disabled={!canPass(view)}
        onClick={() => void playMove({ kind: 'pass' })}
      >
        Pass
      </button>
      <button
        className="button button-primary"
        disabled={!canTake(view)}
        onClick={() => void playMove({ kind: 'take' })}
      >
        Take
      </button>
    </div>
  );
}
