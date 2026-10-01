import { create } from 'zustand';
import type { RoomView } from '@durak/shared';

export type ConnectionStatus = 'connecting' | 'online' | 'offline';

interface RoomState {
  connection: ConnectionStatus;
  /** Latest lobby snapshot from the server (server is the source of truth). */
  room: RoomView | null;
  setConnection: (status: ConnectionStatus) => void;
  setRoom: (room: RoomView) => void;
}

export const useRoomStore = create<RoomState>()((set) => ({
  connection: 'connecting',
  room: null,
  setConnection: (connection) => set({ connection }),
  setRoom: (room) => set({ room }),
}));
