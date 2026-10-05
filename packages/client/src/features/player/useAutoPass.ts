import { useEffect, useRef } from 'react';
import type { PlayerView } from '@durak/shared';
import type { PendingMove } from '../../store/handStore';
import { shouldAutoPass } from './handLogic';
import { playMove } from './playerSession';

/**
 * Passes for the player when waiting would only stall the bout (nothing left to
 * throw in). One automatic pass per snapshot; the next snapshot re-evaluates.
 */
export function useAutoPass(view: PlayerView, pending: PendingMove | null): void {
  const autoPassedAt = useRef<number | null>(null);
  useEffect(() => {
    if (pending || autoPassedAt.current === view.version || !shouldAutoPass(view)) return;
    autoPassedAt.current = view.version;
    void playMove({ kind: 'pass' });
  }, [view, pending]);
}
