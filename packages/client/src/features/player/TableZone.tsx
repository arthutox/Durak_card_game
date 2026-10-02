import { useDroppable } from '@dnd-kit/core';
import type { PlayerView, TablePair } from '@durak/shared';
import { CardFace } from '../../components/CardFace';
import type { PendingMove } from '../../store/handStore';

export const ATTACK_ZONE_ID = 'attack-zone';
export const targetId = (index: number): string => `target-${index}`;

interface TableZoneProps {
  view: PlayerView;
  pending: PendingMove | null;
  /** Attack indexes the dragged card may cover. */
  validTargets: readonly number[];
  /** The dragged card may be thrown onto the table. */
  attackAllowed: boolean;
}

/** The phone's copy of the table: a drop zone for attacks and one per uncovered attack card. */
export function TableZone({ view, pending, validTargets, attackAllowed }: TableZoneProps) {
  const { setNodeRef: setZoneRef, isOver: zoneOver } = useDroppable({
    id: ATTACK_ZONE_ID,
    disabled: !attackAllowed,
  });

  const pairs: (TablePair & { pending?: boolean })[] = view.table.map((pair, index) =>
    pending?.targetIndex === index ? { ...pair, defense: pending.card, pending: true } : pair,
  );
  if (pending && pending.targetIndex === null) {
    pairs.push({ attack: pending.card, defense: null, pending: true });
  }

  return (
    <div
      ref={setZoneRef}
      className={`phone-table${attackAllowed ? ' is-valid' : ''}${zoneOver ? ' is-over' : ''}`}
    >
      {pairs.length === 0 && <p className="muted">The table is empty</p>}
      {pairs.map((pair, index) => (
        <TablePairView
          key={pair.attack.id}
          pair={pair}
          index={index}
          trumpSuit={view.trumpSuit}
          valid={validTargets.includes(index)}
        />
      ))}
    </div>
  );
}

interface TablePairViewProps {
  pair: TablePair & { pending?: boolean };
  index: number;
  trumpSuit: PlayerView['trumpSuit'];
  valid: boolean;
}

function TablePairView({ pair, index, trumpSuit, valid }: TablePairViewProps) {
  const { setNodeRef, isOver } = useDroppable({ id: targetId(index), disabled: !valid });

  return (
    <div
      ref={setNodeRef}
      className={`pair${valid ? ' is-valid' : ''}${isOver ? ' is-over' : ''}${pair.pending ? ' is-pending' : ''}`}
    >
      <CardFace card={pair.attack} trump={pair.attack.suit === trumpSuit} />
      {pair.defense && (
        <span className="pair-defense">
          <CardFace card={pair.defense} trump={pair.defense.suit === trumpSuit} />
        </span>
      )}
    </div>
  );
}
