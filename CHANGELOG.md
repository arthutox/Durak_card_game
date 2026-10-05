# Changelog

Versions follow [semver](https://semver.org). Before 1.0 the protocol and the rules may still change between minor versions.

## 0.9.0 — 2026-10-05

First tagged version: the game is playable end to end on a local network, from the lobby to the results and a rematch.

### Game

- Podkidnoy Durak for 2–6 players, 36 cards, throw-in rules, table limit, drawing order, loser and draw.
- Authoritative server: phones send intents, the server answers with personal snapshots; other hands and the stock order never leave the server.

### Board (laptop)

- Lobby with a QR code, a turn timer selector (Off / 30 / 60 / 90 s) and a remove button (✕) for every seat.
- Players around a virtual round table with a fan of face-down cards and the exact card count; stock, trump, discard, table pairs, status line and a large turn countdown.

### Phone

- Drag-and-drop with a tap shortcut, highlighted valid targets, optimistic moves with rollback, toasts, Pass / Take, auto-pass, reconnect overlay.

### Turn timer

- One deadline per wait; when it runs out the server plays a default move (the defender takes, attackers pass, a main attacker with an empty table attacks with the lowest card).

### Hardening

- The board is accepted only from loopback and only from a localhost page (Origin check).
- Per-connection command rate limit and a 10 kB message cap.
- Same-version snapshots are accepted by the clients, so presence and the turn clock refresh without a move.

### Tooling

- GitHub Actions CI: lint, format check, typecheck, unit and integration tests, build, Playwright browser smoke tests.
- The client is split into per-screen chunks; zod is no longer in the client bundle (431 kB → about 320 kB on a phone, 293 kB on the board).

### Known gaps

- No GIF in the README yet; not yet played on 4–6 phones.
- A game does not continue without a returning player unless the turn timer is on; the host can end the game and remove the seat.
