/** Where a seat sits around the virtual table, as percentages of the table area. */
export interface SeatPosition {
  readonly left: number;
  readonly top: number;
}

const RADIUS_X = 46;
const RADIUS_Y = 44;

/**
 * Seats are spread evenly on an ellipse, clockwise in join order (the same
 * order as the game's turn order), the first seat at the bottom.
 */
export function seatPosition(index: number, count: number): SeatPosition {
  const angle = Math.PI / 2 + (2 * Math.PI * index) / Math.max(1, count);
  return {
    left: round(50 + RADIUS_X * Math.cos(angle)),
    top: round(50 + RADIUS_Y * Math.sin(angle)),
  };
}

const round = (value: number): number => Math.round(value * 100) / 100;

/** A hand of 30 cards is not drawn as 30 cards: the fan is capped, the number says the rest. */
export const MAX_FAN_CARDS = 10;

export const fanSize = (cardCount: number): number =>
  Math.min(Math.max(0, cardCount), MAX_FAN_CARDS);
