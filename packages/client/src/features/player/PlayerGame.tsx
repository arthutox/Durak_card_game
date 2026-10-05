import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { errorMessage } from '@durak/shared';
import type { Card, PlayerView } from '@durak/shared';
import { CardFace } from '../../components/CardFace';
import { PLAYER_COLOR_HEX } from '../../components/playerColors';
import { URGENT_SECONDS, useCountdown } from '../../components/useCountdown';
import { useHandStore } from '../../store/handStore';
import { HandCard } from './HandCard';
import { ATTACK_ZONE_ID, TableZone, targetId } from './TableZone';
import {
  attackableCardIds,
  canPass,
  canTake,
  defendTargets,
  hint,
  isOnClock,
  needsAttention,
  shouldAutoPass,
} from './handLogic';
import { playMove } from './playerSession';

const TOAST_MS = 2500;

/** The phone during a game: opponents, the table, your hand and the Pass / Take buttons. */
export function PlayerGame({ view }: { view: PlayerView }) {
  const pending = useHandStore((s) => s.pendingMove);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const seconds = useCountdown(view.turn);

  // One automatic pass per snapshot; the next snapshot re-evaluates.
  const autoPassedAt = useRef<number | null>(null);
  useEffect(() => {
    if (pending || autoPassedAt.current === view.version || !shouldAutoPass(view)) return;
    autoPassedAt.current = view.version;
    void playMove({ kind: 'pass' });
  }, [view, pending]);

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

function ActionBar({ view }: { view: PlayerView }) {
  return (
    <div className="action-bar">
      <button
        className={`button${needsAttention(view) ? ' is-attention' : ''}`}
        disabled={!canPass(view)}
        onClick={() => void playMove({ kind: 'pass' })}
      >
        Pass
      </button>
      <button
        className="button button-primary"
        disabled={!canTake(view)}
        onClick={() => void playMove({ kind: 'take' })}
      >
        Take
      </button>
    </div>
  );
}

function GameOutcome({ view }: { view: PlayerView }) {
  const { outcome } = view;
  if (!outcome) return null;
  const text =
    outcome.type === 'draw'
      ? "It's a draw!"
      : outcome.playerId === view.me.id
        ? 'You are the Durak 🤡'
        : `${view.players.find((p) => p.id === outcome.playerId)?.nickname ?? 'Someone'} is the Durak`;
  return (
    <div className="panel outcome" role="status">
      <h2>{text}</h2>
      <p className="muted">The host decides what happens next.</p>
    </div>
  );
}

/** A rejected move: the card has already snapped back, this says why. */
function ErrorToast() {
  const toast = useHandStore((s) => s.toast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => useHandStore.getState().clearToast(), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  return (
    <div className="toast" role="alert" key={toast.id}>
      {errorMessage(toast.code)}
    </div>
  );
}
