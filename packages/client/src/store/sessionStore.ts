import { create } from 'zustand';
import type { PlayerId } from '@durak/shared';

const TOKEN_KEY = 'durak.sessionToken';

/**
 * The session token survives page reloads and phone sleeps in localStorage.
 * Storage can be unavailable (private mode, blocked site data), so every
 * access is guarded: without it the phone simply cannot auto-reconnect.
 */
export const tokenStorage = {
  read(): string | undefined {
    try {
      return localStorage.getItem(TOKEN_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  },
  write(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable: reconnect after reload will not work */
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* nothing to clear */
    }
  },
};

interface SessionState {
  /** This phone's seat, or null while not seated. */
  playerId: PlayerId | null;
  setPlayerId: (playerId: PlayerId | null) => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  playerId: null,
  setPlayerId: (playerId) => set({ playerId }),
}));
