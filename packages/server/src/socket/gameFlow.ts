import type { GameEvent } from '@durak/shared';
import { realScheduler, TurnTimer } from '../game/TurnTimer.js';
import type { Scheduler } from '../game/TurnTimer.js';
import { logger } from '../logger.js';
import type { Room } from '../room/Room.js';
import type { Broadcaster } from './broadcaster.js';

/**
 * What happens after the room changed: fan the new state out and re-sync the
 * turn timer. Socket handlers and the timer itself share this, so a timeout
 * move is published exactly like a move made on a phone.
 */
export interface GameFlow {
  /** A game move was accepted (from a phone or from the turn timer). */
  moved(events: readonly GameEvent[]): void;
  /** The room phase changed through a host command. */
  changed(): void;
  dispose(): void;
}

interface Deps {
  readonly room: Room;
  readonly broadcast: Broadcaster;
  readonly scheduler?: Scheduler;
}

export function createGameFlow({ room, broadcast, scheduler = realScheduler }: Deps): GameFlow {
  const timer = new TurnTimer(room, scheduler, (token) => {
    const result = room.actTimeout(token);
    if (!result.ok) {
      logger.warn('turn timeout ignored', { error: result.error });
      return;
    }
    logger.info('turn timeout', {
      moves: result.value.moves.map(([playerId, action]) => ({ playerId, action: action.type })),
    });
    moved(result.value.events);
  });

  function moved(events: readonly GameEvent[]): void {
    broadcast.gameEvents(events);
    // Room state first: clients reset their game view on a phase change, so the
    // snapshot (with the outcome) must arrive after the phase flips to 'finished'.
    if (room.phase === 'finished') broadcast.roomState();
    broadcast.gameState();
    timer.sync();
  }

  return {
    moved,
    changed: () => {
      broadcast.roomState();
      broadcast.gameState();
      timer.sync();
    },
    dispose: () => {
      timer.dispose();
    },
  };
}
