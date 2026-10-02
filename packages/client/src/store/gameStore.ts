import { create } from 'zustand';
import type { PlayerId, PublicView } from '@durak/shared';

export interface Banner {
  /** Distinguishes two banners in a row for the same player. */
  readonly id: number;
  readonly playerId: PlayerId;
}

interface GameState {
  /** Latest public snapshot (the board never sees hands). */
  game: PublicView | null;
  banner: Banner | null;
  /** Older snapshots (out-of-order delivery) are ignored. */
  setGame: (view: PublicView) => void;
  clearGame: () => void;
  showBanner: (playerId: PlayerId) => void;
  clearBanner: () => void;
}

let bannerCounter = 0;

export const useGameStore = create<GameState>()((set) => ({
  game: null,
  banner: null,
  setGame: (view) => set((s) => (s.game && s.game.version >= view.version ? s : { game: view })),
  clearGame: () => set({ game: null, banner: null }),
  showBanner: (playerId) => set({ banner: { id: ++bannerCounter, playerId } }),
  clearBanner: () => set({ banner: null }),
}));
