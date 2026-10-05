import type { ComponentType } from 'react';

/**
 * Two screens, two URLs — no router library needed:
 *   /play      → phone (PlayerHand)
 *   / , /board → laptop (HostBoard)
 *
 * Each screen is its own chunk: a phone never downloads the board's code (QR
 * code, table layout) and the laptop never downloads drag-and-drop. The chunk
 * is loaded *before* the first render instead of through `React.lazy` +
 * `Suspense`, because React holds back a lazily loaded screen after showing the
 * fallback, which cost ~800 ms on every page load.
 */
export async function loadScreen(pathname: string): Promise<ComponentType> {
  if (pathname.startsWith('/play')) {
    return (await import('./features/player/PlayerHand')).PlayerHand;
  }
  return (await import('./features/board/HostBoard')).HostBoard;
}
