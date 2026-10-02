import { useDraggable } from '@dnd-kit/core';
import type { Card } from '@durak/shared';
import { CardFace } from '../../components/CardFace';

interface HandCardProps {
  card: Card;
  trump: boolean;
  /** The card can be played right now (as an attack or a defense). */
  playable: boolean;
  onTap: () => void;
}

export function HandCard({ card, trump, playable, onTap }: HandCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    disabled: !playable,
  });

  return (
    <span
      ref={setNodeRef}
      className={`hand-card${playable ? ' is-playable' : ' is-dimmed'}${isDragging ? ' is-dragging' : ''}`}
      style={
        transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
      }
      onClick={playable ? onTap : undefined}
      {...listeners}
      {...attributes}
    >
      <CardFace card={card} trump={trump} />
    </span>
  );
}
