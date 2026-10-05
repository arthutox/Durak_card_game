/**
 * What this phone's player may do right now, derived from their snapshot.
 * Built on the shared rule primitives, so highlighting never disagrees with
 * the server (which still has the final say).
 */
import { canThrowIn, validDefenseTargets } from '@durak/shared';
import type { Card, CardId, PlayerView } from '@durak/shared';

export type MyRole = 'attacker' | 'thrower' | 'defender' | 'idle' | 'finished';

export function myRole(view: PlayerView): MyRole {
  const { id } = view.me;
  if (view.players.find((p) => p.id === id)?.finished) return 'finished';
  if (id === view.bout.defenderId) return 'defender';
  if (id === view.bout.attackerId) return 'attacker';
  return view.bout.stage === 'open' ? 'thrower' : 'idle';
}

const mayAttack = (view: PlayerView): boolean => {
  const role = myRole(view);
  return role === 'attacker' || role === 'thrower';
};

/** Cards that may be put on the table as an attack / throw-in right now. */
export function attackableCardIds(view: PlayerView): ReadonlySet<CardId> {
  if (view.outcome || !mayAttack(view)) return new Set();
  return new Set(
    view.me.hand
      .filter((card) => canThrowIn(card, view.table, view.bout.limit))
      .map((card) => card.id),
  );
}

/** Indexes of attack cards this card may cover (defender only, not while taking). */
export function defendTargets(view: PlayerView, card: Card): number[] {
  if (view.outcome || myRole(view) !== 'defender' || view.bout.defenderTaking) return [];
  return validDefenseTargets(card, view.table, view.trumpSuit);
}

export function canPass(view: PlayerView): boolean {
  return (
    !view.outcome &&
    mayAttack(view) &&
    view.table.length > 0 &&
    view.me.hand.length > 0 &&
    !view.bout.passed.includes(view.me.id)
  );
}

export function canTake(view: PlayerView): boolean {
  return (
    !view.outcome &&
    myRole(view) === 'defender' &&
    !view.bout.defenderTaking &&
    view.table.some((pair) => pair.defense === null)
  );
}

/**
 * Pass automatically: the player may pass but has nothing left to add and no
 * new rank can appear on the table (everything is covered, or the defender is
 * taking). Waiting would only stall the bout.
 */
export function shouldAutoPass(view: PlayerView): boolean {
  const settled = view.bout.defenderTaking || view.table.every((pair) => pair.defense !== null);
  return canPass(view) && settled && attackableCardIds(view).size === 0;
}

/** True while the turn timer is running and the game is waiting for this player. */
export function isOnClock(view: PlayerView): boolean {
  return view.turn?.onClock.includes(view.me.id) ?? false;
}

/** The defender gave up: attackers should throw in more cards or pass. */
export function needsAttention(view: PlayerView): boolean {
  return view.bout.defenderTaking && canPass(view);
}

/** One line telling the player what to do. */
export function hint(view: PlayerView): string {
  if (view.outcome) return '';
  const nick = (id: string) => view.players.find((p) => p.id === id)?.nickname ?? '?';
  switch (myRole(view)) {
    case 'finished':
      return "You're out of cards. Watch the rest of the game.";
    case 'defender':
      if (view.bout.defenderTaking) return 'You are taking the cards';
      return view.table.length === 0
        ? `${nick(view.bout.attackerId)} is attacking you`
        : 'Drag a card onto an attack card to beat it, or take';
    case 'attacker':
      if (view.bout.defenderTaking)
        return `${nick(view.bout.defenderId)} is taking the cards: throw in more or pass`;
      return view.table.length === 0
        ? 'Your attack: drag a card to the table'
        : 'Add a card to the table, or pass';
    case 'thrower':
      if (view.bout.defenderTaking)
        return `${nick(view.bout.defenderId)} is taking the cards: throw in more or pass`;
      return 'You may throw in a card';
    case 'idle':
      return `${nick(view.bout.attackerId)} is attacking ${nick(view.bout.defenderId)}`;
  }
}
