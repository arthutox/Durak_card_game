import type { Bout } from './bout.js';
import type { Card } from './cards.js';
import type { Suit } from './cards.js';
import type { PlayerId } from './player.js';
import type { TablePair } from './table.js';

export type GameOutcome =
  { readonly type: 'loser'; readonly playerId: PlayerId } | { readonly type: 'draw' };

/** Plain JSON game state: changed only by the engine, safe to serialize and compare. */
export interface GameState {
  /** Monotonic, incremented on every accepted action. */
  readonly version: number;
  /** SECRET: the stock. The top is the END of the array; `deck[0]` is the trump card (drawn last). */
  readonly deck: readonly Card[];
  readonly trumpCard: Card;
  readonly trumpSuit: Suit;
  /** SECRET: each hand is visible only to its owner. */
  readonly hands: Readonly<Record<PlayerId, readonly Card[]>>;
  /** Seats, clockwise. Never shrinks: finished players keep their seat. */
  readonly order: readonly PlayerId[];
  /** Players who are out, in order of leaving. */
  readonly finished: readonly PlayerId[];
  readonly table: readonly TablePair[];
  /** SECRET (only the length is public). */
  readonly discard: readonly Card[];
  readonly isFirstBout: boolean;
  readonly bout: Bout;
  readonly outcome: GameOutcome | null;
}

/** Facts about what just happened; used only for animations and toasts. */
export type GameEvent =
  | { readonly type: 'attack'; readonly playerId: PlayerId; readonly card: Card }
  | {
      readonly type: 'defend';
      readonly playerId: PlayerId;
      readonly card: Card;
      readonly targetAttackIndex: number;
    }
  | { readonly type: 'pass'; readonly playerId: PlayerId }
  | { readonly type: 'take'; readonly playerId: PlayerId }
  | { readonly type: 'bout_beaten'; readonly defenderId: PlayerId }
  | { readonly type: 'bout_taken'; readonly defenderId: PlayerId; readonly count: number }
  | { readonly type: 'player_finished'; readonly playerId: PlayerId }
  | { readonly type: 'game_over'; readonly outcome: GameOutcome };
