import type { PlayerColor } from '@durak/shared';

/** Display values for the fixed palette (chosen to read well on the green felt). */
export const PLAYER_COLOR_HEX: Record<PlayerColor, string> = {
  red: '#ff5a5f',
  orange: '#ff9f43',
  yellow: '#feca57',
  green: '#7bed9f',
  teal: '#48dbfb',
  blue: '#6c8cff',
  purple: '#b388ff',
  pink: '#ff7eb6',
};

export const PLAYER_COLOR_LABEL: Record<PlayerColor, string> = {
  red: 'Red',
  orange: 'Orange',
  yellow: 'Yellow',
  green: 'Green',
  teal: 'Teal',
  blue: 'Blue',
  purple: 'Purple',
  pink: 'Pink',
};
