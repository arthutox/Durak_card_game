import type { PlayerId, PublicView } from '@durak/shared';

export type SeatRole = 'attacker' | 'thrower' | 'defender' | 'finished' | 'idle';

/** Role of a player in the current bout, derived from the public snapshot. */
export function seatRole(game: PublicView, playerId: PlayerId): SeatRole {
  const player = game.players.find((p) => p.id === playerId);
  if (player?.finished) return 'finished';
  if (playerId === game.bout.defenderId) return 'defender';
  if (playerId === game.bout.attackerId) return 'attacker';
  return game.bout.stage === 'open' ? 'thrower' : 'idle';
}

export const ROLE_LABEL: Record<SeatRole, string> = {
  attacker: 'Attacking',
  thrower: 'Can throw in',
  defender: 'Defending',
  finished: 'Out',
  idle: '',
};

/** What the table is waiting for, as a short sentence for the center of the board. */
export function statusLine(game: PublicView): string {
  const nick = (id: PlayerId) => game.players.find((p) => p.id === id)?.nickname ?? '?';
  const { bout, table } = game;
  if (game.outcome) return '';
  if (bout.defenderTaking) return `${nick(bout.defenderId)} is taking the cards`;
  if (table.length === 0) return `${nick(bout.attackerId)} opens the bout`;
  if (table.some((pair) => pair.defense === null)) return `${nick(bout.defenderId)} is defending`;
  return bout.stage === 'primary'
    ? `${nick(bout.attackerId)} may add a card or pass`
    : 'Anyone may throw in a card';
}
