# Durak LAN — Architecture

A local multiplayer version of Podkidnoy Durak. The laptop is the **board** (server + shared screen); smartphones are the players' **hands**. This document records the agreed decisions, the state model, the Socket.IO protocol, the monorepo layout and the sprint plan.

Items marked *(planned)* do not exist in the code yet.

---

## 0. Key principles

| Principle | How it is implemented |
|---|---|
| **The server is the single source of truth** | Clients send only *intents* (commands). Only the server changes state, through the pure rules engine. |
| **Anti-cheat through projections** | The full state never goes over the network. Each recipient gets its own projection: a player gets `PlayerView` (own hand + public data), the board gets `PublicView`. |
| **Snapshots, not deltas** | After every change the server sends a new snapshot with a `version`. Clients cannot drift out of sync, and reconnecting is just "send me the snapshot". Fine-grained `game:event` messages exist only for animations and toasts. |
| **Engine without I/O** | `packages/shared/src/engine` contains pure functions `(state, action) → state | error`. The RNG is injected, so tests are deterministic. |
| **FCFS without locks** | Node is single-threaded: a socket handler synchronously reads state → validates → applies. There is no `await` between the read and the write, so throw-in races are resolved by message arrival order. |
| **The client is untrusted** | Every payload is validated with zod schemas from `shared` at the server boundary. |

---

## 1. Rules (agreed)

- 36-card deck (6–A), 2–6 players, 6 cards each, the trump is the bottom face-up card of the stock.
- The player holding the lowest trump attacks first. Play goes clockwise (= join order).
- **Table limit** per bout: `min(isFirstBout ? 5 : 6, defender's hand size at bout start)`.
- **Bout stages:**
  - `primary` — only the main attacker attacks (opening card + throw-ins).
  - After the main attacker passes → `open`: every active player except the defender may throw in, first come, first served.
  - The defender may defend in either stage by placing a card on a specific uncovered attack card.
- **Passes:** any new attack card resets the passes of all attackers.
- **Beaten:** every card is covered ∧ every attacker has passed (or nothing more can be thrown in — the limit is reached).
- **Take:** the defender declares a take → the same state machine runs (priority → open), but defending is no longer allowed. When everyone has passed (or the limit is reached), the defender takes the table.
- **Drawing:** main attacker → other attackers clockwise → defender last, up to 6 cards while the stock lasts.
- **Next bout:** after "Beaten" the former defender attacks; after "Take" the player after the defender attacks. Players who are out are skipped.
- **Out of the game:** stock empty and hand empty → the player is out. The last player holding cards is the durak (loser). If the last two (or all) run out at the same moment, the game is a draw.
- **Rematch** keeps the lobby; the first attacker is again the holder of the lowest trump.
- Priority/turn timer — optional, last sprint.

**Defaults (not discussed explicitly, easy to change):**
- 6 players × 6 cards = the whole deck. In that case the last dealt card is revealed as trump and stays in its owner's hand.
- Nobody holds a trump → a random player attacks first.
- An attacker with an empty hand (stock exhausted) is treated as having passed.
- An attacker who holds cards but has nothing to throw in must still press "Pass": the engine never skips them on its own, so the UI must keep Pass visible (and the optional timer, if built, covers the stalled case).
- The discard pile is face down: only its size is public.
- In the lobby a disconnected player keeps the seat via the token; "Start" is unavailable while anyone is offline; "Leave" frees the seat.

---

## 2. State architecture

### 2.1 Domain types (`shared/src/domain`)

```ts
export type Suit = 'S' | 'H' | 'D' | 'C';                  // ♠ ♥ ♦ ♣
export type Rank = 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14; // 11=J … 14=A
export type CardId = `${Suit}${Rank}`;                     // 'H10', 'S14' — unique in a 36-card deck

export interface Card { readonly id: CardId; readonly suit: Suit; readonly rank: Rank }

export type PlayerId = string;                             // public UUID
export const PLAYER_COLORS = ['red','orange','yellow','green','teal','blue','purple','pink'] as const;
export type PlayerColor = typeof PLAYER_COLORS[number];

export interface TablePair {
  readonly attack: Card;
  readonly defense: Card | null;                           // null = not covered yet
}
```

In commands the client sends only a `CardId`; the server looks the card up in the player's hand itself (a player cannot "play" a card they do not hold).

### 2.2 Server: full state (never leaves the process)

```ts
// --- Room: lobby, sessions, sockets (stateful wrapper, server/src/room) ---
interface Room {
  phase: 'lobby' | 'playing' | 'finished';
  seats: Seat[];                    // order = join order = clockwise
  game: GameState | null;           // outcome lives in game.outcome; phase becomes 'finished'
}

interface Seat {
  playerId: PlayerId;
  sessionToken: string;             // SECRET: crypto.randomUUID(), sent only to its owner
  nickname: string;                 // unique, 1–16 chars, trimmed
  color: PlayerColor;               // unique
  socketId: string | null;          // null ⇒ "offline"
}

// --- Game: plain data, changed only by the engine (shared/src/engine) ---
interface GameState {
  version: number;                  // monotonic, incremented on every change
  deck: Card[];                     // SECRET: stock order; deck[0] is the trump card (drawn last)
  trumpCard: Card;                  // public
  trumpSuit: Suit;
  hands: Record<PlayerId, Card[]>;  // SECRET: each hand is visible only to its owner
  order: PlayerId[];                // seats, clockwise
  finished: PlayerId[];             // players who are out, in order of leaving
  table: TablePair[];
  discard: Card[];                  // SECRET (only the length is public)
  isFirstBout: boolean;
  bout: Bout;
  outcome: null | { type: 'loser'; playerId: PlayerId } | { type: 'draw' };
}

interface Bout {
  attackerId: PlayerId;             // main attacker
  defenderId: PlayerId;
  stage: 'primary' | 'open';
  defenderTaking: boolean;          // pressed "Take"
  passed: PlayerId[];               // who has passed since the last attack card
  limit: number;                    // fixed at bout start
}
```

`GameState` is plain JSON with no `Set`/`Map`/classes: easy to serialize, compare in tests and log.

### 2.3 Engine (`shared/src/engine`) — public interface

Implemented (sprint 0):

```ts
createDeck(): Card[];
shuffle<T>(items: readonly T[], rng: Rng): T[];
deal(shuffledDeck, playerIds): { hands; stock; trumpCard };

canBeat(attack: Card, defense: Card, trump: Suit): boolean;
tableLimit({ defenderHandSize, isFirstBout }): number;
canThrowIn(card: Card, table: TablePair[], limit: number): boolean;
remainingSlots(table: TablePair[], limit: number): number;
validDefenseTargets(card: Card, table: TablePair[], trump: Suit): number[];
isTableCovered(table: TablePair[]): boolean;

firstAttacker(order, hands, trumpSuit, rng): PlayerId;
nextActive(order, fromId, isActive): PlayerId | null;
```

The rule primitives are used **both** by the server (validation) and by the client (highlighting valid targets).

Implemented (sprint 1):

```ts
type Action =
  | { type: 'attack'; cardId: CardId }                          // opening card or throw-in
  | { type: 'defend'; cardId: CardId; targetAttackIndex: number }
  | { type: 'pass' }
  | { type: 'take' };

createGame(playerIds: PlayerId[], rng: Rng): GameState;
applyAction(state: GameState, playerId: PlayerId, action: Action)
  : Result<{ state: GameState; events: GameEvent[] }, ErrorCode>;
```

Internal split of the engine (SRP): `deck.ts` (create/shuffle/deal), `rules.ts` (primitives above), `turnOrder.ts` (next active player, first attacker), `bout.ts` (bout state machine), `draw.ts` (drawing), `game.ts` (`createGame`/`applyAction` facade).

### 2.4 Projections — the anti-cheat boundary (`server/src/game/projections.ts`)

```ts
toPlayerView(state: GameState, room: Room, viewer: PlayerId): PlayerView;
toPublicView(state: GameState, room: Room): PublicView;
```

| Data | Server | Player's phone | Board (laptop) |
|---|---|---|---|
| Own hand | ✅ | ✅ | ❌ |
| Other hands | ✅ | count only | count only |
| Stock order | ✅ | ❌ (`deckCount`) | ❌ (`deckCount`) |
| Trump card | ✅ | ✅ | ✅ |
| Table (pairs) | ✅ | ✅ | ✅ |
| Discard pile | ✅ (cards) | count only | count only |
| `sessionToken` | ✅ all | own only (in the join ack) | ❌ |
| Passes, stage, limit, roles | ✅ | ✅ | ✅ |

Required test: `JSON.stringify(toPlayerView(state, A))` contains no `CardId` from B's hand, the stock or the discard pile — except the face-up trump card.

### 2.5 Client: what React stores (Zustand)

Views sent by the server:

```ts
interface RoomView {                         // lobby — visible to everyone (implemented)
  phase: Room['phase'];
  players: Array<{ id: PlayerId; nickname: string; color: PlayerColor; online: boolean }>;
  takenColors: PlayerColor[];
  joinUrl: string;                           // for the QR code on the board
}

interface PublicView {
  version: number;
  players: Array<{
    id: PlayerId; nickname: string; color: PlayerColor;
    cardCount: number; online: boolean; finished: boolean;
  }>;
  trumpCard: Card; trumpSuit: Suit; deckCount: number;
  table: TablePair[]; discardCount: number;
  bout: { attackerId: PlayerId; defenderId: PlayerId; stage: 'primary' | 'open';
          defenderTaking: boolean; passed: PlayerId[]; limit: number };
  isFirstBout: boolean;
  outcome: GameState['outcome'];
}

interface PlayerView extends PublicView {
  me: { id: PlayerId; hand: Card[] };
}
```

Stores:
- `store/roomStore.ts` — connection status and the latest `RoomView` (both screens).
- `store/sessionStore.ts` — this phone's `playerId`; the `sessionToken` lives in `localStorage` behind a guarded wrapper.
- `store/gameStore.ts` — the latest `PublicView` for the board (older `version`s are ignored; cleared on every room phase change so a rematch can restart at version 0) and the board banner. `store/handStore.ts` holds the phone's `PlayerView`, the `pendingMove` for the optimistic drop and the error toast; `features/player/handLogic.ts` derives role, attackable cards, defend targets, Pass/Take availability.

Derived data are **selectors, not fields** (DRY, single source of truth): `myRole` (`attacker` / `thrower` / `defender` / `idle` / `finished`), `canPass`, `canTake`, `validTargets(cardId)` — built on `shared/engine/rules`.

---

## 3. Socket.IO protocol

### 3.1 Connection and roles

- One namespace `/`. The role is passed in the handshake: `io({ auth: { role: 'player', sessionToken? } })` or `{ role: 'board' }`.
- `role: 'board'` is accepted **only from loopback** (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`); otherwise `connect_error` with `FORBIDDEN`.
- In development the client connects to the game server (:3000) directly rather than through a Vite proxy, so the server sees real client addresses.
- A player with a valid `sessionToken` is reattached to their seat on connect (reconnect). Socket.IO repeats the handshake with the same `auth` callback on every reconnect. The newest connection wins: an older socket holding the same seat is disconnected.
- Socket.IO rooms: `board`, `players`, `player:<playerId>` (snapshots go to each seat's socket directly).

### 3.2 Client → Server (commands)

Every command is acknowledged: `(res: Ack<T>) => void`, where `Ack<T> = { ok: true; data: T } | { ok: false; error: ErrorCode }`.

| Event | Who | Payload | Ack `data` | Possible errors |
|---|---|---|---|---|
| `lobby:join` | player | `{ nickname: string; color: PlayerColor }` | `{ playerId; sessionToken }` | `NICKNAME_INVALID`, `NICKNAME_TAKEN`, `COLOR_TAKEN`, `ROOM_FULL`, `GAME_IN_PROGRESS`, `ALREADY_JOINED` |
| `lobby:leave` | player | `{}` | `{}` | `NOT_JOINED`, `GAME_IN_PROGRESS` |
| `game:attack` | player | `{ cardId: CardId }` | `{}` | `NOT_IN_HAND`, `NOT_YOUR_TURN`, `PRIORITY_ATTACKER_ONLY`, `RANK_NOT_ON_TABLE`, `TABLE_LIMIT` |
| `game:defend` | player | `{ cardId: CardId; targetAttackIndex: number }` | `{}` | `NOT_DEFENDER`, `NOT_IN_HAND`, `TARGET_INVALID`, `TARGET_ALREADY_COVERED`, `CANNOT_BEAT`, `ALREADY_TAKING` |
| `game:pass` | player | `{}` | `{}` | `NOT_AN_ATTACKER`, `PRIORITY_ATTACKER_ONLY`, `TABLE_EMPTY`, `ALREADY_PASSED` |
| `game:take` | player | `{}` | `{}` | `NOT_DEFENDER`, `NOTHING_TO_TAKE`, `ALREADY_TAKING` |
| `host:start` | board | `{}` | `{}` | `NOT_ENOUGH_PLAYERS`, `PLAYERS_OFFLINE`, `GAME_IN_PROGRESS` |
| `host:abort` | board | `{}` | `{}` | `NO_GAME` |
| `host:rematch` | board | `{}` | `{}` | `NOT_FINISHED`, `PLAYERS_OFFLINE` |
| `host:toLobby` | board | `{}` | `{}` | `NOT_FINISHED` |

Any payload that fails its zod schema → `VALIDATION`. An unexpected exception in a handler is logged and answered with `INTERNAL`. Handlers are registered per role, so a socket only has the commands of its own role (the board has no player commands, phones have no `host:*` commands).

Why there is no `play_card` / `deal_cards` / `successful_defense` from the original brief:
- `play_card` is split into `game:attack` and `game:defend`: they have different payloads and rules (ISP).
- `deal_cards` and `successful_defense` are not commands but *consequences*: the deal arrives as a snapshot after `host:start`, and "Beaten" is `game:event { type: 'bout_beaten' }`.

### 3.3 Server → Client

| Event | To | Payload | When |
|---|---|---|---|
| `room:state` | everyone | `RoomView` | any change in the lobby, presence or phase |
| `session:restored` | socket | `{ playerId }` | the handshake token was accepted (reconnect) |
| `session:invalid` | socket | — | unknown token (e.g. the server restarted) → the client clears `localStorage` |
| `game:state` | `player:<id>` | `PlayerView` | after every game change, on reconnect |
| `board:state` | `board` | `PublicView` | after every game change, when the board connects |
| `game:event` | `players` + `board` | `GameEvent` | animations/toasts (does not change client state) |
| `board:banner` | `board` | `{ playerId; kind: 'cannot_beat' }` | an invalid defense attempt (fun message) |

```ts
type GameEvent =                      // shared/src/domain/game.ts
  | { type: 'attack'; playerId; card }
  | { type: 'defend'; playerId; card; targetAttackIndex }
  | { type: 'pass'; playerId }
  | { type: 'take'; playerId }
  | { type: 'bout_beaten'; defenderId }
  | { type: 'bout_taken'; defenderId; count }
  | { type: 'player_finished'; playerId }
  | { type: 'game_over'; outcome };   // never contains hidden cards beyond the table
```

Order on the server after a successful command: `applyAction` → store state → emit `game:event`(s) → emit snapshots. The client applies only snapshots; events are purely cosmetic.

### 3.4 Typed event map (`shared/src/protocol/events.ts`)

```ts
export interface ClientToServerEvents {
  'lobby:join':  (p: JoinPayload, ack: AckFn<JoinResult>) => void;
  'lobby:leave': (p: EmptyPayload, ack: AckFn<EmptyPayload>) => void;
  // 'game:attack' | 'game:defend' | 'game:pass' | 'game:take' | 'host:start' | 'host:abort' | 'host:rematch' | 'host:toLobby'
}

export interface ServerToClientEvents {
  'room:state':       (v: RoomView) => void;
  'session:invalid':  () => void;
  'session:restored': (s: { playerId: PlayerId }) => void;
  // 'game:state' | 'board:state' | 'game:event' | 'board:banner'
}

// server: new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(httpServer)
// client: const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(...)
```

On the server every command is registered through `onCommand(socket, event, schema, handler)` (`server/src/socket/command.ts`), which applies validation, the guaranteed ack and error handling in one place.

### 3.5 Invalid-move UX and FCFS races

1. While dragging, the phone highlights valid targets (`validDefenseTargets` / `canThrowIn` from `shared/engine/rules`).
2. On drop the card visually "sticks" to the target (`pendingMove`) and the command is sent.
3. Ack `ok` → wait for the snapshot (usually milliseconds later; `pendingMove` is cleared).
4. Ack `error` → the card animates back to the hand + a toast:
   - `CANNOT_BEAT` → a toast on the phone **and** `board:banner` on the board ("Nice try, but no");
   - `TABLE_LIMIT` (lost the race) → only a "The table is full" toast; nothing is shown on the board.

---

## 4. Monorepo layout

```
durak/
├── package.json              # root scripts: dev, build, start, test, lint, typecheck, format
├── pnpm-workspace.yaml       # packages/*
├── tsconfig.base.json        # strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes
├── eslint.config.js
├── README.md
├── CLAUDE.md
├── docs/
│   └── ARCHITECTURE.md
└── packages/
    ├── shared/                       # @durak/shared — no Node/DOM dependencies
    │   └── src/
    │       ├── lib/result.ts         # Result<T, E>
    │       ├── domain/               # cards, player, table
    │       ├── engine/
    │       │   ├── constants.ts      # HAND_SIZE, bout limits
    │       │   ├── rng.ts            # injectable + seeded RNG
    │       │   ├── deck.ts           # createDeck, shuffle, deal
    │       │   ├── rules.ts          # canBeat, canThrowIn, tableLimit, validDefenseTargets
    │       │   ├── turnOrder.ts      # nextActive, firstAttacker
    │       │   ├── bout.ts / draw.ts / game.ts   # bout state machine, drawing, facade
    │       │   └── *.test.ts
    │       ├── protocol/
    │       │   ├── ack.ts            # Ack<T>, ackOk, ackError
    │       │   ├── errors.ts         # ErrorCode + user-facing texts
    │       │   ├── events.ts         # ClientToServerEvents / ServerToClientEvents
    │       │   ├── schemas.ts        # zod schemas for payloads and the handshake
    │       │   └── views.ts          # RoomView, PublicView, PlayerView
    │       └── index.ts
    ├── server/                       # @durak/server
    │   ├── src/
    │   │   ├── index.ts              # entry point: listen on 0.0.0.0, graceful shutdown
    │   │   ├── createGameServer.ts   # composition root (used by integration tests)
    │   │   ├── config.ts             # ports, LAN IP detection, join URL
    │   │   ├── logger.ts
    │   │   ├── http/static.ts        # serves client/dist + SPA fallback (production)
    │   │   ├── room/
    │   │   │   ├── Room.ts           # the only stateful object: lobby, seats, sessions
    │   │   │   └── lobbyRules.ts     # nickname normalization and uniqueness
    │   │   ├── game/projections.ts   # toPlayerView / toPublicView
    │   │   └── socket/
    │   │       ├── types.ts          # typed Server/Socket, channel names
    │   │       ├── auth.ts           # handshake: role, token, loopback check
    │   │       ├── command.ts        # onCommand: zod → handler → ack (DRY)
    │   │       ├── playerHandlers.ts
    │   │       ├── boardHandlers.ts
    │   │       └── broadcaster.ts    # all outgoing state fan-out
    │   └── test/                     # integration tests with a real socket.io-client
    └── client/                       # @durak/client — Vite + React
        └── src/
            ├── main.tsx
            ├── App.tsx               # /play → PlayerHand, / and /board → HostBoard
            ├── socket/
            │   ├── socket.ts         # typed Socket<S2C, C2S>
            │   └── useRoomSync.ts    # connection + room:state → store
            ├── store/                # roomStore, sessionStore (gameStore, selectors planned)
            ├── features/
            │   ├── board/            # HostBoard, BoardLobby, GameTable, Results, BoutBanner, boardSession
            │   └── player/           # PlayerHand, JoinForm, WaitingRoom, playerSession
            │                         # (Hand, DraggableCard, drop zones, ActionBar planned)
            ├── components/           # PlayerList, ColorPicker, ConnectionBadge, playerColors
            └── styles/
```

Dependency rule: `client → shared ← server`. `shared` imports nothing from `client`/`server`; the engine knows nothing about sockets.

`@durak/shared` is consumed as TypeScript source through the `development` export condition (Vite dev, `tsx --conditions=development`, Vitest), and as `dist/` in production builds.

---

## 5. Sprint plan

Every sprint ends with a working, verifiable result (definition of done).

| # | Sprint | Scope | Done when | Status |
|---|---|---|---|---|
| 0 | **Skeleton + lobby** | pnpm monorepo, Express + Socket.IO, lobby join/leave, session-token reconnect, loopback-only board, `HostBoard`/`PlayerHand` lobby screens, rule primitives (deck, deal, trump, `canBeat`, `canThrowIn`, table limit, first attacker, turn order) | unit + integration tests green; a phone joins over the LAN | ✅ |
| 1 | **Game engine** (TDD) | `createGame`; `applyAction`: attack, defend a specific card, pass (`primary → open`) with pass reset, take, beaten; drawing, turn passing, players leaving, loser/draw | a test for every rule in §1 + a simulation of random legal games: always 36 cards, every game terminates | ✅ |
| 2 | **Game protocol** (server) | `host:*` commands, `game:attack/defend/pass/take`, projections, `game:state` / `board:state` / `game:event` / `board:banner`, snapshot on reconnect | integration tests: views do not leak; the last-slot race is covered at engine level (first-come-first-served, `TABLE_LIMIT`); a full game played by three scripted clients | ✅ |
| 3 | **Board UI** (`HostBoard`) | table pairs, stock + trump, discard pile, players around the table (card count, role, pass, offline), banner, results, host buttons | the whole game is visible on the laptop | ✅ |
| 4 | **Hand UI + drag-and-drop** (`PlayerHand`) | card fan, dnd-kit (touch/pointer sensors), attack zone and defend targets, valid-target highlighting, optimistic drop + rollback, toasts, Pass / Take buttons | a full game on two phones | ⏳ implemented, awaiting a real-phone playtest |
| 5 | **Finishing touches** | animations, reconnect UX, playtest on 3–6 phones (3 phones done), README with GIF/screenshots, quieter test logs; *optional:* priority/turn timer | ready for the portfolio | |

---

## 6. Commands

```bash
pnpm install
pnpm dev              # server (tsx watch) + client (vite) in parallel
pnpm build            # tsc for shared/server, vite build for client
pnpm start            # production: Express serves client/dist
pnpm test             # vitest in every package
pnpm --filter @durak/shared test rules.test.ts -t "canThrowIn"   # one file / one test (no `--`)
pnpm lint && pnpm typecheck
```
