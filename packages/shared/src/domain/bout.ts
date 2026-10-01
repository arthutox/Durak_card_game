import type { PlayerId } from './player.js';

/** `primary`: only the main attacker may attack. `open`: every active non-defender may throw in. */
export type BoutStage = 'primary' | 'open';

/** State of the bout in progress (one attack-and-defense exchange). */
export interface Bout {
  /** Main attacker: opens the bout and has priority in the `primary` stage. */
  readonly attackerId: PlayerId;
  readonly defenderId: PlayerId;
  readonly stage: BoutStage;
  /** The defender pressed "Take": defending is no longer allowed. */
  readonly defenderTaking: boolean;
  /** Attackers who passed since the last attack card. */
  readonly passed: readonly PlayerId[];
  /** Max attack cards, fixed when the bout starts. */
  readonly limit: number;
}
