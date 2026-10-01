import type { Card } from './cards.js';

/** One attack card on the table and the card that covers it (if any). */
export interface TablePair {
  readonly attack: Card;
  readonly defense: Card | null;
}
