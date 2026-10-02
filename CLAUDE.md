# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Status:** Sprint 0 done — monorepo skeleton, lobby (join/leave/reconnect, localhost-only board), rule primitives (`deck`, `rules`, `turnOrder`) with tests, HostBoard/PlayerHand lobby screens. Sprint 1 done: bout state machine, hand refill, `createGame`/`applyAction`, turn passing, end of game and a random-game simulation live in `shared/src/engine`. Sprint 2 done: `host:*` and `game:*` commands, projections, `game:state`/`board:state`/`game:event`/`board:banner`, snapshots on reconnect, a full-game integration test. Sprint 3 done: `HostBoard` shows the lobby, the game table (seats, stock + trump, discard, table pairs, status line), the `CANNOT_BEAT` banner, results and host buttons. Sprint 4 done: `PlayerGame` on the phone (dnd-kit drag-and-drop with tap shortcut, valid-target highlighting, optimistic drop with rollback, toasts, Pass/Take). First playtest done; fixes are ongoing (late game-over screen, Pass highlight, auto-pass). Next: Sprint 5 (finishing touches). The full design is in `docs/ARCHITECTURE.md` — read it before implementing anything.

## Project

A LAN multiplayer "Podkidnoy Durak" card game, built as a portfolio piece showing advanced React + Node.js. The laptop runs the server and shows the shared **board**; players join from phone browsers (QR code with the LAN URL), and each phone is that player's **hand**.

## Conventions

- **All project documentation is written in English**: `README.md`, everything in `docs/`, this file, code comments and JSDoc. This applies to new docs and to edits of existing ones.
- The user interface is in English too: screen texts and the error messages in `shared/src/protocol/errors.ts`.

## Commands

```bash
pnpm install
pnpm dev                     # server (tsx watch) + client (vite)
pnpm build                   # tsc (shared, server) + vite build (client)
pnpm start                   # prod: Express serves client/dist
pnpm test                    # vitest in all packages
pnpm --filter @durak/shared test bout.test.ts -t "<test name>"   # single test (no `--`, or the filter is ignored)
pnpm lint && pnpm typecheck
pnpm format                  # prettier --write .
```

- Requires Node >= 22 and pnpm 10 (`packageManager` is pinned).
- Server tests: unit tests sit next to the source (`room/Room.test.ts`, `socket/auth.test.ts`); socket-level integration tests live in `packages/server/test/` (e.g. `lobby.integration.test.ts`).

- Dev: board at `http://localhost:5173/board`, phones at `http://<LAN-IP>:5173/play` (the server prints the join URL). The client connects to the game server on :3000 directly, not via a Vite proxy, so the server sees real client IPs (the board role is loopback-only).
- `@durak/shared` is consumed as TypeScript source via the `development` export condition (Vite dev, `tsx --conditions=development`, Vitest `resolve.conditions`); production builds use `shared/dist`, so `pnpm build` builds `shared` first.
- TypeScript is pinned to `~6.0` because typescript-eslint does not support TS 7 yet.

## Architecture

- **Stack:** TypeScript everywhere. pnpm workspaces (no Turborepo): `packages/shared`, `packages/server` (Express + Socket.IO), `packages/client` (Vite + React + Zustand + dnd-kit). Tests: Vitest.
- **Dependency rule:** `client → shared ← server`. `shared` has no Node/DOM dependencies.
- **Rules engine** lives in `packages/shared/src/engine`: pure functions, no I/O, injected RNG. The server uses it as the authority; the client uses its primitives (`canBeat`, `canThrowIn`) only to highlight valid drop targets.
- **Authoritative state is on the server only.** Clients send commands (intents) with acks; the server applies them through the engine and broadcasts **snapshots**: a personal `PlayerView` per player, a `PublicView` for the board. `game:event` messages exist only for animations/toasts.
- **Anti-cheat boundary:** `server/src/game/projections.ts`. Hands of others, deck order, discard contents and session tokens never leave the server.
- **Concurrency:** socket handlers stay synchronous between reading and writing state (no `await` in between), so throw-in races resolve first-come-first-served by message order.
- **Server layout:** `server/src/room` holds the room state and lobby rules; `server/src/socket` holds the Socket.IO layer (`auth.ts` handshake/role, `playerHandlers.ts` / `boardHandlers.ts` per-role intents, `command.ts` zod-validate + ack wrapper, `broadcaster.ts` snapshot fan-out). New intents go through `command.ts` and the schemas in `shared/protocol`.
- **Sessions:** `lobby:join` returns `playerId` + `sessionToken`; the client stores the token in `localStorage` and sends it in the handshake `auth` to reclaim its seat after a disconnect. One room per server.
- **Board role** is accepted only from loopback (`127.0.0.1` / `::1`).
- All client payloads are validated with zod schemas from `shared/protocol/schemas.ts`.

## Rules variants (decided)

- Podkidnoy (throw-in), no perevodnoy. 36-card deck (6–A). 2–6 players, seats clockwise in join order.
- Deal 6 each; trump = bottom face-up card of the deck (with 6 players the last dealt card is shown and stays in that hand).
- First attacker: lowest trump in hand (random if nobody has a trump). Rematch uses the same rule.
- Table limit per bout: `min(isFirstBout ? 5 : 6, defender's hand size at bout start)`.
- Bout stages: `primary` (only the main attacker attacks/throws in) → after the main attacker passes, `open` (every active non-defender may throw in, first-come-first-served).
- The defender beats a specific attack card (`targetAttackIndex`). Any new attack card resets all passes.
- Beaten: everything covered and all attackers passed (or the limit is reached). Take: same state machine without defending; when all attackers pass, the defender takes the table.
- Draw order: main attacker, other attackers clockwise, defender last. Next attacker: the former defender after "Beaten", the player after the defender after "Take". Finished players are skipped.
- A player with no cards when the deck is empty is out. The last player holding cards loses; if the last players run out at the same time, it is a draw.
- Invalid move: private ack error + card snaps back + toast on the phone; `CANNOT_BEAT` also shows a fun banner on the board. Lost FCFS races (`TABLE_LIMIT`) are not shown on the board.
- Turn/priority timer: optional, last sprint.
