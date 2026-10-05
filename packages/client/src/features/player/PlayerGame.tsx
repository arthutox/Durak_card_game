import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { Card, PlayerView } from '@durak/shared';
import { CardFace } from '../../components/CardFace';
import { PLAYER_COLOR_HEX } from '../../components/playerColors';
import { URGENT_SECONDS, useCountdown } from '../../components/useCountdown';
import { useHandStore } from '../../store/handStore';
import { ActionBar } from './ActionBar';
import { ErrorToast } from './ErrorToast';
import { GameOutcome } from './GameOutcome';
import { HandCard } from './HandCard';
import { useAutoPass } from './useAutoPass';
import { ATTACK_ZONE_ID, TableZone, targetId } from './TableZone';
import { attackableCardIds, defendTargets, hint, isOnClock } from './handLogic';
import { playMove } from './playerSession';

/** The phone during a game: opponents, the table, your hand and the Pass / Take buttons. */
export function PlayerGame({ view }: { view: PlayerView }) {
  const pending = useHandStore((s) => s.pendingMove);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const seconds = useCountdown(view.turn);

  useAutoPass(view, pending);

  // Mouse for desktop testing; touch needs a short press so the page can still scroll.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
  );

  const attackable = attackableCardIds(view);
  const targetsOf = (card: Card) => defendTargets(view, card);
  const playable = (card: Card) => attackable.has(card.id) || targetsOf(card).length > 0;

  const play = (card: Card, overId: string | null) => {
    if (overId === ATTACK_ZONE_ID && attackable.has(card.id)) {
      void playMove({ kind: 'attack', cardId: card.id }, card);
      return;
    }
    const targetAttackIndex = targetsOf(card).find((index) => targetId(index) === overId);
    if (targetAttackIndex !== undefined) {
      void playMove({ kind: 'defend', cardId: card.id, targetAttackIndex }, card);
    }
  };

  /** Tap shortcut: play a card where it can only go to one place. */
  const tap = (card: Card) => {
    const targets = targetsOf(card);
    if (attackable.has(card.id)) void playMove({ kind: 'attack', cardId: card.id }, card);
    else if (targets.length === 1) {
      void playMove({ kind: 'defend', cardId: card.id, targetAttackIndex: targets[0]! }, card);
    }
  };

  const onDragStart = ({ active }: DragStartEvent) =>
    setActiveCard(view.me.hand.find((card) => card.id === active.id) ?? null);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveCard(null);
    const card = view.me.hand.find((candidate) => candidate.id === active.id);
    if (card) play(card, over ? String(over.id) : null);
  };

  const hand = view.me.hand.filter((card) => card.id !== pending?.card.id);
  const me = view.players.find((p) => p.id === view.me.id);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveCard(null)}
    >
      <section className="phone-game">
        <div className="opponents">
          {view.players
            .filter((p) => p.id !== view.me.id)
            .map((p) => (
              <span key={p.id} className={`opponent${p.online ? '' : ' is-offline'}`}>
                <span style={{ color: PLAYER_COLOR_HEX[p.color] }}>{p.nickname}</span>{' '}
                {p.finished ? '✓' : p.cardCount}
              </span>
            ))}
          <span className="opponent trump-info">
            Stock {view.deckCount} · Trump <CardFace card={view.trumpCard} trump />
          </span>
        </div>

        <TableZone
          view={view}
          pending={pending}
          validTargets={activeCard ? targetsOf(activeCard) : []}
          attackAllowed={activeCard !== null && attackable.has(activeCard.id)}
        />

        <p className="hint" role="status">
          {hint(view)}
          {seconds !== null && isOnClock(view) && (
            <span className={`turn-clock${seconds <= URGENT_SECONDS ? ' is-urgent' : ''}`}>
              {' '}
              · {seconds} s
            </span>
          )}
        </p>

        <ActionBar view={view} />

        <div className="hand-cards" aria-label={`Your hand, ${me?.nickname ?? ''}`}>
          {hand.map((card) => (
            <HandCard
              key={card.id}
              card={card}
              trump={card.suit === view.trumpSuit}
              playable={playable(card)}
              onTap={() => tap(card)}
            />
          ))}
        </div>

        <GameOutcome view={view} />
        <ErrorToast />
      </section>
      <DragOverlay>{activeCard && <CardFace card={activeCard} />}</DragOverlay>
    </DndContext>
  );
}
