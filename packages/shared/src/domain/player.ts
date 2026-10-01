/** Public player identifier (UUID). Safe to broadcast, unlike the session token. */
export type PlayerId = string;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

/** Fixed palette: one color per player, taken colors are unavailable to others. */
export const PLAYER_COLORS = [
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'pink',
] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];

export const NICKNAME_MAX_LENGTH = 16;
