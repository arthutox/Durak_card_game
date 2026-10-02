import { create } from 'zustand';
import type { Card, ErrorCode, PlayerView } from '@durak/shared';

/** A card dropped but not yet acknowledged by the server. */
export interface PendingMove {
  readonly card: Card;
  /** Attack index being covered, or null for an attack / throw-in. */
  readonly targetIndex: number | null;
}

export interface Toast {
  readonly id: number;
  readonly code: ErrorCode;
}

interface HandState {
  /** Latest personal snapshot. */
  view: PlayerView | null;
  pendingMove: PendingMove | null;
  toast: Toast | null;
  setView: (view: PlayerView) => void;
  clearView: () => void;
  setPending: (move: PendingMove | null) => void;
  showToast: (code: ErrorCode) => void;
  clearToast: () => void;
}

let toastCounter = 0;

export const useHandStore = create<HandState>()((set) => ({
  view: null,
  pendingMove: null,
  toast: null,
  setView: (view) => set((s) => (s.view && s.view.version >= view.version ? s : { view })),
  clearView: () => set({ view: null, pendingMove: null, toast: null }),
  setPending: (pendingMove) => set({ pendingMove }),
  showToast: (code) => set({ toast: { id: ++toastCounter, code } }),
  clearToast: () => set({ toast: null }),
}));
