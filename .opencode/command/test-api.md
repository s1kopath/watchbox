---
description: Run the offline smoke test for the server layer (no accounts/network needed).
agent: build
---

Run `npm test` in the project root and report the results. This runs
`scripts/smoke-test.mjs`, which exercises the list CRUD operations
(`app/lib/lists.server.js`) and the session-cookie round-trip
(`app/lib/session.server.js`) against a throwaway local SQLite file — it does
not touch Turso, Vercel, TMDB, or any real account, and finishes in ~1s.

Use this after any change under `app/lib/*.server.js` or a route
`loader`/`action`. If an assertion fails, read the named server module and
`scripts/smoke-test.mjs` to find the mismatch before proposing a fix.

For a full live end-to-end check (auth cookie flow, TMDB, UI rendering) against
a running `npm run dev` server, see `.claude/commands/smoke-test.md`.
