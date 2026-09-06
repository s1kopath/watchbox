# MovieList

A PWA for tracking movies you've watched and want to watch. Multi-user
(email/password), movie data pulled from TMDB, lists stored per-user in a
cloud SQLite database. Installable on mobile like a native app.

Read this file first. It should answer most "how does this work" questions
without needing to grep the whole codebase.

## Stack

- **Frontend**: React 19 + Vite 8, `react-router-dom` v7, `vite-plugin-pwa`.
  No TypeScript, no CSS framework — plain CSS in `src/index.css`.
- **Backend**: Vercel serverless functions under `api/`. Plain
  `export default function handler(req, res)` per file — no framework, no
  `@vercel/node` types required at runtime (it's just a devDependency for
  editor types).
- **Database**: [Turso](https://turso.tech) (libSQL, SQLite-compatible) via
  `@libsql/client`. Schema is created automatically on first request
  (`api/_db.js` → `ensureSchema()`), there is no separate migration step or
  migration files.
- **Auth**: JWT (`jsonwebtoken`) + `bcryptjs` for password hashing. No
  server-side sessions — the client stores the JWT in `localStorage` and
  decodes the payload locally to get `{ id, email }` (see
  `src/context/AuthContext.jsx`).
- **Movie data**: TMDB API v3, proxied server-side through
  `api/movies/search.js` and `api/movies/trending.js` so `TMDB_API_KEY` never
  reaches the browser.

## Repo layout

```
api/
  _db.js              Turso client singleton + ensureSchema()
  _auth.js             signToken / verifyToken / getUserFromReq
  auth/register.js      POST /api/auth/register
  auth/login.js         POST /api/auth/login
  movies/search.js      GET  /api/movies/search?q=&page=
  movies/trending.js    GET  /api/movies/trending
  lists/index.js        GET/POST /api/lists            (auth required)
  lists/[id].js         PATCH/DELETE /api/lists/:id     (auth required)

src/
  api/client.js          fetch wrapper, attaches `Authorization: Bearer <jwt>`
  context/AuthContext.jsx   login/register/logout, decodes JWT client-side
  context/ListsContext.jsx  fetches/caches entries, exposes watched/wantToWatch,
                            addOrUpdate/rate/remove — all pages read from here,
                            don't call src/api/client.js directly from pages
  components/MovieCard.jsx  shared card for search results AND list items
  components/BottomNav.jsx  mobile-style bottom tab bar
  pages/Login.jsx, Register.jsx, Search.jsx, MyList.jsx, Profile.jsx

scripts/
  test-api-local.mjs     offline smoke test for all api/ handlers (see below)
  generate-icons.mjs     regenerates public/*.png from icon-source.svg (needs `sharp`)
  icon-source.svg        source art for the app icon

vercel.json              rewrites: /api/* to functions, everything else to index.html (SPA)
vite.config.js            PWA manifest/icons/workbox config + dev proxy of /api -> :3000
```

## Data model

Single table `movie_entries` (see `api/_db.js` for the exact DDL):

- `UNIQUE(user_id, tmdb_id)` — a user can only have one entry per movie.
  Adding a movie that's already in the other list uses
  `ON CONFLICT DO UPDATE` to just flip its `status`, it does not create a
  duplicate row.
- `status` is `'watched'` or `'want_to_watch'` (CHECK constraint — these are
  the only two valid values, no others).
- `watched_at` is set automatically when status becomes `'watched'` and
  cleared when it isn't.
- `rating` (1–5) only makes sense for watched entries; the UI only shows
  stars on the Watched tab.

## Environment variables

See `.env.example`. Required: `TMDB_API_KEY`, `TURSO_DATABASE_URL`,
`TURSO_AUTH_TOKEN`, `JWT_SECRET`. These belong to the user's own accounts —
never invent or guess values for them.

## Commands

| Command                              | What it does                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| `npm install`                         | install deps                                                                    |
| `npm run dev`                         | Vite dev server (frontend only), proxies `/api/*` to `localhost:3000`          |
| `npm run dev:api`                     | `vercel dev --listen 3000` — serves the `/api` functions locally               |
| `npm run build`                       | `vite build` — also generates the PWA service worker via vite-plugin-pwa       |
| `node scripts/test-api-local.mjs`     | **offline** smoke test of every `api/` handler, no accounts/network needed     |

**Prefer `node scripts/test-api-local.mjs` over `npm run dev:api` for
verifying API changes.** It runs the actual handler functions against a
throwaway local SQLite file (`file:./scripts/.tmp-test.db`, auto-cleaned up)
and finishes in under a second. `vercel dev` is heavier and may prompt for
Vercel account login/linking on first run — only reach for it if you
actually need to test through real HTTP requests.

## Gotchas / conventions

- **ESM import hoisting**: static `import` statements are hoisted above other
  top-level code in a module, even code written textually above them. If a
  script needs to set `process.env.X` before an `api/` handler reads it at
  import time, use dynamic `await import(...)` *after* setting the env vars.
  See the top of `scripts/test-api-local.mjs` for the working pattern —
  don't reintroduce the bug of setting env vars above static imports.
- New API endpoints: follow the existing `handler(req, res)` signature (no
  framework). Call `ensureSchema()` before any DB query, and
  `getUserFromReq(req)` from `api/_auth.js` for anything that requires login
  (returns `null` if unauthenticated — check for that and return 401).
- New frontend features: read/write through `useLists()` /
  `useAuth()` (the context providers), don't call `src/api/client.js`
  directly from a page component — keep list state centralized so Search and
  MyList stay in sync.
- Icons in `public/*.png` are generated, not hand-drawn. To change them, edit
  `scripts/icon-source.svg`, then
  `npm install -D sharp && node scripts/generate-icons.mjs && npm uninstall sharp`.
  `sharp` is intentionally not a persistent dependency.

## Rules for agents working in this repo

- Never run commands that log into or link third-party accounts (`vercel
  login`, `vercel link`, `turso auth login`, `gh auth login`, etc.) without
  the user explicitly asking for it — these touch the user's own accounts.
  (Codified in `opencode.json` permissions as `"ask"`.)
- Never deploy (`vercel --prod`, `vercel deploy`) or `git push` without an
  explicit request. (Also codified as `"ask"` in `opencode.json`.)
- Don't commit `.env` (already gitignored) — only `.env.example` should be
  tracked, and it must only ever contain empty/placeholder values.
- When you touch `api/**`, run `node scripts/test-api-local.mjs` before
  calling the work done.

## Status

Fully built and committed. **Not yet deployed** — deployment needs the
user's own TMDB key, Turso database, and Vercel account/login, all documented
step-by-step in `README.md`.

## Known gaps / possible follow-up work (not started)

- No dedicated movie detail page/route (overview is shown inline in cards
  only, pulled straight from the search/trending response).
- No password reset flow.
- No pagination UI for search results (TMDB returns `page`/`total_pages` but
  the frontend only requests page 1).
