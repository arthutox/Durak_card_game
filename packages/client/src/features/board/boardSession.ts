import { createSocket } from '../../socket/socket';
import { useRoomSync } from '../../socket/useRoomSync';

/** The host screen connects with the board role (accepted from localhost only). */
export const boardSocket = createSocket(() => ({ role: 'board' }));

export function useBoardSession(): void {
  useRoomSync(boardSocket);
}
