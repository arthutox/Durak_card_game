import { HostBoard } from './features/board/HostBoard';
import { PlayerHand } from './features/player/PlayerHand';

/**
 * Two screens, two URLs — no router library needed:
 *   /play      → phone (PlayerHand)
 *   / , /board → laptop (HostBoard)
 */
export function App() {
  return window.location.pathname.startsWith('/play') ? <PlayerHand /> : <HostBoard />;
}
