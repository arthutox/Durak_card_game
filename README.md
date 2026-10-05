# Durak LAN

A digital version of the Russian card game **Podkidnoy Durak** for a group of friends on the same Wi-Fi network.
The laptop is the **shared table** (server + big screen with the stock, the trump and the cards in play); smartphones are the **players' hands**: everyone joins from the phone's browser by scanning a QR code and plays their own cards.

> **Status:** the game is playable end to end: lobby, a full game on the board and on phones, results and rematch. A 3-phone playtest went well. The optional turn timer is built (pick Off / 30 / 60 / 90 s in the lobby). Remaining work: a README GIF — see the [roadmap](#roadmap).

- Up to 6 players, 36-card deck, podkidnoy (throw-in) variant
- Drag a card onto the table to attack or onto an attack card to beat it; tap a card as a shortcut
- Pass and Take buttons; Pass is highlighted when the defender takes, and it fires automatically when you have nothing left to throw in
- Nothing to install on phones: the game runs in the browser
- The server is the single source of truth: a phone never receives other players' cards or the stock order

---

## Tech stack

### General

| Technology | What it is | Why it is used |
|---|---|---|
| **TypeScript 6** | Typed JavaScript | One language on the client and the server. Strict mode catches errors before runtime; the Socket.IO event types are shared by both sides, so client and server cannot drift apart in the protocol |
| **pnpm workspaces** | Package manager with monorepo support | Three packages (`shared`, `server`, `client`) in one repository, one lockfile, one command to run everything |
| **Node.js 22** | JavaScript runtime | Runs the game server on the laptop |

### Shared package `@durak/shared`

| Technology | What it is | Why it is used |
|---|---|---|
| **Rules engine** (own code) | Pure functions without I/O: what beats what, whether a card can be thrown in, table limit, dealing, the bout state machine, drawing, turn passing, end of game | The server uses it to validate every move, the phone uses it to highlight playable cards. One implementation of the rules instead of two |
| **zod 4** | Runtime data validation | The client is untrusted: anyone on the network can open a socket and send anything. Every incoming payload is checked against a schema before it reaches the game logic |

### Server `@durak/server`

| Technology | What it is | Why it is used |
|---|---|---|
| **Express 5** | HTTP framework | Serves the built React client in production and answers `/health` |
| **Socket.IO 4** | Real-time two-way communication over WebSocket | Moves and table updates arrive instantly. Acknowledgements give every command an "ok" or an error code; rooms separate broadcasts to the board and to players; phones reconnect automatically |
| **tsx** | Runs TypeScript without a build step | Fast server restarts on code changes during development |

### Client `@durak/client`

| Technology | What it is | Why it is used |
|---|---|---|
| **React 19** | UI library | Two screens built from shared components: `HostBoard` (laptop) and `PlayerHand` (phone) |
| **Vite 8** | Build tool and dev server | Instant reloads during development; phones can open the dev server over the local network |
| **Zustand 5** | Lightweight state store | The client keeps only the latest snapshot from the server, so a thin store is enough — no Redux boilerplate |
| **qrcode.react** | QR code generation | The board shows a QR code with the join link, so players never have to type an IP address |
| **dnd-kit** | Drag-and-drop with touch support | Players drag a card with a finger from the hand onto the table or onto a specific opponent's card |

### Code quality

| Technology | What it is | Why it is used |
|---|---|---|
| **Vitest 5** | Test framework | Unit tests for the rules and the lobby; integration tests with a real Socket.IO server and clients |
| **ESLint + typescript-eslint** | Static analysis | Consistent style, common mistakes caught, React hooks rules |
| **Prettier** | Code formatter | Identical formatting without review debates |

---

## Architecture at a glance

```
 Phone (React)                Laptop: Node.js                    Laptop: browser (React)
┌──────────────┐  commands  ┌────────────────────────────┐ snapshot ┌──────────────────┐
│  PlayerHand  │ ─────────▶ │ Socket.IO → zod validation │ ───────▶ │    HostBoard     │
│  (own hand)  │ ◀───────── │ → Room → rules engine      │          │ (shared table,QR)│
└──────────────┘  snapshot  └────────────────────────────┘          └──────────────────┘
                (own cards only)
```

- The phone sends only **intents** ("I want to play this card"); only the server changes the state.
- After every change the server broadcasts **snapshots**: each player gets their own (with their cards), the board gets a public one.
- The board screen is accepted **only from the laptop itself** (localhost, and only from a page served from localhost), so a player cannot open it from a phone, and a web page on another site cannot control the game from the host's browser.
- Every connection has a command budget and a message size cap, so one misbehaving client cannot flood the server.
- Hands of other players, the stock order and the discard pile never leave the server: all views are built in one place (`server/src/game/projections.ts`) and covered by leak tests.
- A move is applied optimistically on the phone and rolled back with a toast if the server rejects it.

**Good to know:** the game runs over plain HTTP on your local network, which is fine for a living-room game. A phone's session token travels in the clear on the Wi-Fi, so anyone on the same network who can sniff traffic could take over that seat. Play on a network you trust.

Details — state model, Socket.IO event table, rules — are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Repository layout

```
packages/
├── shared/   # types, rules engine, protocol (events, schemas, error codes)
├── server/   # Express + Socket.IO, lobby, sessions, game protocol, projections
└── client/   # React: HostBoard (/board) and PlayerHand (/play)
docs/         # architecture and plan
```

---

## Running locally

### Requirements

- **Node.js 22** or newer (`node -v`)
- **pnpm** — enabled with `corepack`, which ships with Node
- The laptop and the phones on the **same Wi-Fi network**

### Install

```bash
git clone git@github.com:arthutox/Durak_card_game.git
cd Durak_card_game
corepack enable      # activates the pinned pnpm version
pnpm install
```

### Development mode

```bash
pnpm dev
```

Starts two processes: the game server on port `3000` and Vite on port `5173`.

1. On the laptop, open **http://localhost:5173/board** — the table screen with the QR code.
2. Scan the QR code with a phone (or open `http://<laptop-IP>:5173/play`; the address is also printed in the server console).
3. Enter a nickname, pick a color and take a seat.
4. When at least 2 players are seated and online, press **Start game** on the board. After the game, **Play again** or **Back to lobby**.

To try it without a phone, open `http://localhost:5173/play` in several tabs or private windows.

### Production mode

```bash
pnpm build    # builds shared, server and client
pnpm start    # Express serves the built client
```

Board: **http://localhost:3000/board**; phones join via the QR code (`http://<laptop-IP>:3000/play`).

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Game server port |
| `PUBLIC_PORT` | `5173` in dev, `PORT` in production | Port used in the QR code link |
| `VITE_SERVER_PORT` | `3000` | Server port the client connects to in dev mode (if you change `PORT`) |

### If a phone cannot connect

- **macOS asks whether Node may accept incoming connections** — click "Allow". If you already denied it: System Settings → Network → Firewall.
- The phone and the laptop must be on the same network. Guest Wi-Fi and some routers isolate devices from each other; a VPN on the laptop can get in the way too.
- If the QR code shows the wrong IP (several network adapters), open the correct address on the phone manually.

---

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Server and client in development mode |
| `pnpm build` | Production build of all packages |
| `pnpm start` | Run the built server |
| `pnpm test` | All tests |
| `pnpm --filter @durak/shared test rules.test.ts` | Tests in one file |
| `pnpm --filter @durak/shared test rules.test.ts -t "canThrowIn"` | One test or group by name |
| `pnpm typecheck` | Type checking |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |

## Tests

- **Rules** (`packages/shared/src/engine/*.test.ts`) — what beats what, throw-ins, table limit (5 cards in the first bout, 6 afterwards), dealing and trump (including 6 players), first attacker by lowest trump, the bout state machine, drawing order, turn passing, loser and draw. A simulation plays 200 random legal games (2–6 players) and checks that there are always 36 distinct cards and every game ends.
- **Lobby** (`packages/server/src/room/Room.test.ts`) — unique nickname and color, 6-player limit, the seat is kept on disconnect, no secret tokens in the data sent to clients.
- **Projections** (`packages/server/src/game/projections.test.ts`) — a player's view contains no other hand, stock card or session token.
- **Integration** (`packages/server/test/`) — a real server on a random port and real Socket.IO clients: joining, validation errors, reconnect by token, host commands, rejected moves, the board banner, and a whole game played by three scripted phones with rematch.
- **Client** (`packages/client/src/**/*.test.ts`) — what the phone may do (playable cards, drop targets, Pass/Take, auto-pass), board roles and status line, the snapshot stores, seat layout around the table.
- **Browser smoke tests** (`packages/e2e`, Playwright) — the built server with a real board and two phone-sized browsers: taking seats, removing a seat, and a game with the turn timer. Run with `pnpm build && pnpm test:e2e`.

---

## Roadmap

| Sprint | Scope | Status |
|---|---|---|
| 0 | Monorepo skeleton, lobby, reconnect, core rules with tests | ✅ |
| 1 | Game engine: attack, defend, pass, take, beaten, drawing, end of game | ✅ |
| 2 | Game protocol: move commands, per-player snapshots, projections | ✅ |
| 3 | Board screen: cards on the table, stock, trump, discard pile, players, results | ✅ |
| 4 | Hand screen: card drag-and-drop, playable-card highlighting, Pass and Take buttons | ✅ first playtest done, fixes ongoing |
| 5 | Finishing touches: card animations and reconnect overlay ✅, 3-phone playtest ✅; optional turn timer ✅; still open: GIF in the README (a 4–6 phone run is a nice-to-have) | ⏳ |

## Rules in short

Podkidnoy Durak, 36 cards, 2–6 players. The player with the lowest trump attacks first; play goes clockwise. The defender beats each attack card with a higher card of the same suit or with a trump — or takes all the cards on the table. Other players may throw in cards of ranks already on the table, but never more than the defender can cover. The last player left holding cards loses and is the *durak* ("fool").

