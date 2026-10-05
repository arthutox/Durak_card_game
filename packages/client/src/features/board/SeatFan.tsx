import { fanSize } from './seatLayout';

/** A player's hand as a fan of face-down cards; the count is on the seat itself. */
export function SeatFan({ cardCount }: { cardCount: number }) {
  const size = fanSize(cardCount);
  return (
    <span className="seat-fan" aria-hidden="true" style={{ '--n': size } as React.CSSProperties}>
      {Array.from({ length: size }, (_, i) => (
        <span key={i} className="mini-card" style={{ '--i': i } as React.CSSProperties} />
      ))}
    </span>
  );
}
