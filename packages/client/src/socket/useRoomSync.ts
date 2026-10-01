import { useEffect } from 'react';
import type { RoomView } from '@durak/shared';
import { useRoomStore } from '../store/roomStore';
import type { ClientSocket } from './socket';

/**
 * Connects the socket for the lifetime of the screen and mirrors connection
 * status + lobby snapshots into the store. Shared by both screens (DRY).
 */
export function useRoomSync(socket: ClientSocket): void {
  useEffect(() => {
    const { setConnection, setRoom } = useRoomStore.getState();
    const onConnect = () => setConnection('online');
    const onDisconnect = () => setConnection('offline');
    const onConnectError = () => setConnection('offline');
    const onRoomState = (view: RoomView) => setRoom(view);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('room:state', onRoomState);
    setConnection('connecting');
    socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('room:state', onRoomState);
      socket.disconnect();
    };
  }, [socket]);
}
