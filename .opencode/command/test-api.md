---
description: Run the offline smoke test for all api/ handlers (no accounts/network needed).
agent: build
---

Run `node scripts/test-api-local.mjs` in the project root and report the
results. This exercises register/login/list-CRUD against a temporary local
SQLite file — it does not touch Turso, Vercel, or any real account. Use this
after any change under `api/**` instead of spinning up `vercel dev`.

If any assertion fails, read the relevant `api/` handler and
`scripts/test-api-local.mjs` to find the mismatch before proposing a fix.
