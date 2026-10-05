import type { PlayerView } from '@durak/shared';

export function GameOutcome({ view }: { view: PlayerView }) {
  const { outcome } = view;
  if (!outcome) return null;
  const text =
    outcome.type === 'draw'
      ? "It's a draw!"
      : outcome.playerId === view.me.id
        ? 'You are the Durak 🤡'
        : `${view.players.find((p) => p.id === outcome.playerId)?.nickname ?? 'Someone'} is the Durak`;
  return (
    <div className="panel outcome" role="status">
      <h2>{text}</h2>
      <p className="muted">The host decides what happens next.</p>
    </div>
  );
}
