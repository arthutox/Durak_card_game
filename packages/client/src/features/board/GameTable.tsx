import type { PublicView } from '@durak/shared';
import { CardBack, CardFace } from '../../components/CardFace';
import { PLAYER_COLOR_HEX } from '../../components/playerColors';
import { URGENT_SECONDS, useCountdown } from '../../components/useCountdown';
import { ROLE_LABEL, seatRole, statusLine } from './boardRoles';

/** The running game as everyone at the table sees it. No hands: only counts. */
export function GameTable({ game }: { game: PublicView }) {
  const seconds = useCountdown(game.turn);
  return (
    <section className="game-table">
      <div className="seats">
        {game.players.map((player) => {
          const role = seatRole(game, player.id);
          const passed = game.bout.passed.includes(player.id);
          return (
            <div
              key={player.id}
              className={`seat seat-${role}${player.online ? '' : ' is-offline'}`}
              style={{ borderColor: PLAYER_COLOR_HEX[player.color] }}
            >
              <span className="nickname" style={{ color: PLAYER_COLOR_HEX[player.color] }}>
                {player.nickname}
              </span>
              <span className="seat-cards">{player.finished ? '—' : `${player.cardCount} 🂠`}</span>
              {ROLE_LABEL[role] && <span className="badge">{ROLE_LABEL[role]}</span>}
              {passed && <span className="badge">passed</span>}
              {seconds !== null && game.turn?.onClock.includes(player.id) && (
                <span
                  className={`badge badge-clock${seconds <= URGENT_SECONDS ? ' is-urgent' : ''}`}
                >
                  {seconds} s
                </span>
              )}
              {!player.online && <span className="badge badge-warn">offline</span>}
            </div>
          );
        })}
      </div>

      <div className="felt">
        <div className="piles">
          <div className="pile" title="Stock">
            {game.deckCount > 0 ? (
              <CardBack count={game.deckCount} />
            ) : (
              <span className="card card-empty" />
            )}
            <span className="pile-trump">
              {game.deckCount > 0 ? (
                <CardFace card={game.trumpCard} trump />
              ) : (
                <span className="trump-suit-only">Trump {suitName(game)}</span>
              )}
            </span>
          </div>
          <div className="pile" title="Discard">
            <span className="card card-empty">{game.discardCount}</span>
            <span className="muted small">discard</span>
          </div>
        </div>

        <div className="table-area">
          {game.table.length === 0 ? (
            <p className="muted">The table is empty</p>
          ) : (
            game.table.map((pair) => (
              <div className="pair" key={pair.attack.id}>
                <CardFace card={pair.attack} trump={pair.attack.suit === game.trumpSuit} />
                {pair.defense && (
                  <span className="pair-defense">
                    <CardFace card={pair.defense} trump={pair.defense.suit === game.trumpSuit} />
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <p className="status-line" role="status">
        {statusLine(game)}
        {!game.outcome && (
          <span className="muted small">
            {' '}
            · {game.table.length}/{game.bout.limit} cards
          </span>
        )}
      </p>
    </section>
  );
}

function suitName(game: PublicView): string {
  return { S: '♠', H: '♥', D: '♦', C: '♣' }[game.trumpSuit];
}
