import type { Card } from '@durak/shared';
import { SUIT_SYMBOL, isRedSuit, rankLabel } from './cardLabel';

interface CardFaceProps {
  card: Card;
  /** Highlights the trump suit on the table. */
  trump?: boolean;
}

export function CardFace({ card, trump = false }: CardFaceProps) {
  const classes = ['card', isRedSuit(card.suit) ? 'is-red' : '', trump ? 'is-trump' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <span
      className={classes}
      role="img"
      aria-label={`${rankLabel(card.rank)} ${SUIT_SYMBOL[card.suit]}`}
    >
      <span className="card-rank">{rankLabel(card.rank)}</span>
      <span className="card-suit">{SUIT_SYMBOL[card.suit]}</span>
    </span>
  );
}

/** A face-down card (the stock). */
export function CardBack({ count }: { count?: number }) {
  return (
    <span className="card card-back" aria-label="Stock">
      {count !== undefined && <span className="card-count">{count}</span>}
    </span>
  );
}
