/**
 * A whole game over real sockets: the board and three phones, driven by a
 * simple scripted strategy that only uses what each phone is allowed to see.
 */
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { canThrowIn, remainingSlots, validDefenseTargets } from '@durak/shared';
import type {
  Ack,
  ClientToServerEvents,
  PlayerView,
  PublicView,
  ServerToClientEvents,
} from '@durak/shared';
import { createGameServer } from '../src/createGameServer.js';
import type { GameServerInstance } from '../src/createGameServer.js';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface Phone {
  readonly socket: ClientSocket;
  view: PlayerView | null;
  token: string;
}

let server: GameServerInstance;
let url: string;
let board: ClientSocket;
let boardView: PublicView | null;
const phones: Phone[] = [];
const boardLog: string[] = [];
const sockets: ClientSocket[] = [];

beforeEach(async () => {
  server = createGameServer(
    { port: 0, publicPort: 0, isProduction: false, clientDistDir: '' },
    'http://test/play',
  );
  await new Promise<void>((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}`;
  boardView = null;
});

afterEach(async () => {
  sockets.splice(0).forEach((socket) => socket.disconnect());
  phones.length = 0;
  await server.io.close();
});

function open(auth: Record<string, unknown>): ClientSocket {
  const socket: ClientSocket = connect(url, { auth, transports: ['websocket'], forceNew: true });
  sockets.push(socket);
  return socket;
}

function send<E extends keyof ClientToServerEvents>(
  socket: ClientSocket,
  event: E,
  payload: Record<string, unknown>,
): Promise<Ack<unknown>> {
  return new Promise((resolve) => {
    (socket.emit as (...args: unknown[]) => void)(event, payload, resolve);
  });
}

async function seatPlayers(names: readonly string[]): Promise<void> {
  board = open({ role: 'board' });
  boardLog.length = 0;
  board.on('board:state', (view) => {
    boardView = view;
    boardLog.push('board:state');
  });
  board.on('room:state', () => boardLog.push('room:state'));
  const colors = ['red', 'blue', 'green', 'teal'];
  for (const [i, name] of names.entries()) {
    const socket = open({ role: 'player' });
    const phone: Phone = { socket, view: null, token: '' };
    socket.on('game:state', (view) => (phone.view = view));
    phones.push(phone);
    const ack = await send(socket, 'lobby:join', { nickname: name, color: colors[i] });
    expect(ack.ok).toBe(true);
    phone.token = (ack as { ok: true; data: { sessionToken: string } }).data.sessionToken;
  }
}

async function until(condition: () => boolean, label: string): Promise<void> {
  for (let i = 0; i < 400; i++) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`timed out: ${label}`);
}

const synced = (): boolean => {
  const version = server.room.game?.version;
  return phones.every((p) => p.view?.version === version) && boardView?.version === version;
};

/** Candidate moves for one phone, best first: defend, attack, pass, take. */
function candidates(view: PlayerView): [keyof ClientToServerEvents, Record<string, unknown>][] {
  const moves: [keyof ClientToServerEvents, Record<string, unknown>][] = [];
  for (const card of view.me.hand) {
    for (const targetAttackIndex of validDefenseTargets(card, view.table, view.trumpSuit)) {
      moves.push(['game:defend', { cardId: card.id, targetAttackIndex }]);
    }
  }
  for (const card of view.me.hand) {
    if (
      remainingSlots(view.table, view.bout.limit) > 0 &&
      canThrowIn(card, view.table, view.bout.limit)
    ) {
      moves.push(['game:attack', { cardId: card.id }]);
    }
  }
  if (!view.bout.passed.includes(view.me.id)) moves.push(['game:pass', {}]);
  moves.push(['game:take', {}]);
  return moves;
}

async function playToTheEnd(): Promise<void> {
  for (let step = 0; step < 3000 && server.room.game?.outcome === null; step++) {
    let moved = false;
    const defenderFirst = [...phones].sort(
      (a, b) =>
        Number(b.view!.me.id === b.view!.bout.defenderId) -
        Number(a.view!.me.id === a.view!.bout.defenderId),
    );
    for (const phone of defenderFirst) {
      for (const [event, payload] of candidates(phone.view!)) {
        const ack = await send(phone.socket, event, payload);
        if (ack.ok) {
          moved = true;
          break;
        }
      }
      if (moved) break;
    }
    expect(moved, 'some phone must always have a legal move').toBe(true);
    await until(synced, 'snapshots reach everyone');
  }
}

describe('game over Socket.IO', () => {
  it('only the board may start, and needs at least two players', async () => {
    await seatPlayers(['A']);

    // Phones have no `host:*` handlers at all: the command is simply ignored.
    phones[0]!.socket.emit('host:start', {}, () => undefined);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(server.room.phase).toBe('lobby');
    expect(await send(board, 'host:start', {})).toEqual({ ok: false, error: 'NOT_ENOUGH_PLAYERS' });
  });

  it('start deals personal snapshots that do not leak other hands', async () => {
    await seatPlayers(['A', 'B', 'C']);
    expect(await send(board, 'host:start', {})).toEqual({ ok: true, data: {} });
    await until(synced, 'first snapshots');

    const game = server.room.game!;
    for (const phone of phones) {
      const json = JSON.stringify(phone.view);
      const others = game.order
        .filter((id) => id !== phone.view!.me.id)
        .flatMap((id) => game.hands[id]!)
        .concat(game.deck.slice(1));
      for (const card of others) expect(json).not.toContain(`"${card.id}"`);
    }
    expect(JSON.stringify(boardView)).not.toMatch(/"hand"|"hands"/);
  });

  it('rejects a move from someone who is not on turn, and no game commands before the start', async () => {
    await seatPlayers(['A', 'B']);
    expect(await send(phones[0]!.socket, 'game:pass', {})).toEqual({ ok: false, error: 'NO_GAME' });

    await send(board, 'host:start', {});
    await until(synced, 'first snapshots');
    const defender = phones.find((p) => p.view!.me.id === p.view!.bout.defenderId)!;
    const card = defender.view!.me.hand[0]!;

    expect(await send(defender.socket, 'game:attack', { cardId: card.id })).toEqual({
      ok: false,
      error: 'NOT_YOUR_TURN',
    });
  });

  it('sends the board a banner when a defense cannot beat the card', async () => {
    await seatPlayers(['A', 'B']);
    const banner = new Promise((resolve) => board.on('board:banner', resolve));
    await send(board, 'host:start', {});
    await until(synced, 'first snapshots');

    const attacker = phones.find((p) => p.view!.me.id === p.view!.bout.attackerId)!;
    const defender = phones.find((p) => p !== attacker)!;
    await send(attacker.socket, 'game:attack', { cardId: attacker.view!.me.hand[0]!.id });
    await until(synced, 'attack visible');

    const target = defender.view!;
    const loser = target.me.hand.find(
      (card) => validDefenseTargets(card, target.table, target.trumpSuit).length === 0,
    );
    if (!loser) return; // every card beats it: nothing to reject in this deal
    const ack = await send(defender.socket, 'game:defend', {
      cardId: loser.id,
      targetAttackIndex: 0,
    });

    expect(ack).toEqual({ ok: false, error: 'CANNOT_BEAT' });
    expect(await banner).toEqual({ playerId: defender.view!.me.id, kind: 'cannot_beat' });
  });

  it('plays a whole game with three scripted phones and finishes in the lobby again', async () => {
    await seatPlayers(['A', 'B', 'C']);
    await send(board, 'host:start', {});
    await until(synced, 'first snapshots');

    await playToTheEnd();
    await until(synced, 'final snapshots');

    expect(server.room.phase).toBe('finished');
    // The outcome must be the *last* thing the board hears, after the phase change.
    expect(boardLog.at(-1)).toBe('board:state');
    expect(boardView!.outcome).not.toBeNull();
    expect(phones.every((p) => p.view!.outcome !== null)).toBe(true);

    expect(await send(board, 'host:rematch', {})).toEqual({ ok: true, data: {} });
    await until(synced, 'rematch snapshots');
    expect(boardView!.outcome).toBeNull();
    expect(server.room.phase).toBe('playing');

    expect(await send(board, 'host:abort', {})).toEqual({ ok: true, data: {} });
    expect(server.room.phase).toBe('lobby');
  }, 30_000);

  it('a reconnecting phone gets its snapshot back', async () => {
    await seatPlayers(['A', 'B']);
    await send(board, 'host:start', {});
    await until(synced, 'first snapshots');
    const first = phones[0]!;

    const reconnected = open({ role: 'player', sessionToken: first.token });
    const view = await new Promise<PlayerView>((resolve) => reconnected.on('game:state', resolve));

    expect(view.me).toEqual(first.view!.me);
    expect(view.version).toBe(first.view!.version);
  });
});
