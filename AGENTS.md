# MovieBox

A PWA for tracking movies you've watched and want to watch. Multi-user
(email/password), movie data pulled from TMDB, lists stored per-user in a
cloud SQLite database. Installable on mobile like a native app.

Read this file first. It should answer most "how does this work" questions
without needing to grep the whole codebase.

## Stack

- **Framework**: [React Router v7 in framework mode](https://reactrouter.com/)
  (the successor to Remix) with SSR. React 19, Vite 8. No TypeScript, no CSS
  framework — plain CSS in `app/index.css`.
- **Backend**: there is no separate backend. Every route module can export a
  server-only `loader` (read) and `action` (write) that run on the server;
  server-only code lives in `app/lib/*.server.js`. In production these run as
  Vercel serverless functions via the `@vercel/react-router` preset.
- **Database**: [Turso](https://turso.tech) (libSQL, SQLite-compatible) via
  `@libsql/client`. Schema is created automatically on first request
  (`app/lib/db.server.js` → `ensureSchema()`), no migration step or files.
- **Auth**: httpOnly **session cookie** (not localStorage). `JWT_SECRET` signs
  the cookie via React Router's `createCookieSessionStorage`
  (`app/lib/session.server.js`). The cookie holds `{ userId, email }`; loaders
  read it server-side with `getUser(request)` / `requireUser(request)`. There
  is no client-readable token and no `jsonwebtoken` dependency any more.
  `bcryptjs` still hashes passwords.
- **Movie data**: TMDB API v3, fetched in loaders through
  `app/lib/tmdb.server.js` so `TMDB_API_KEY` never reaches the browser.

## Repo layout

```
app/
  root.jsx               HTML document shell (Layout), <Outlet>, ErrorBoundary,
                         links() for index.css, registers the service worker
  routes.js              route table (explicit config, not file-based)
  index.css              all styling (plain CSS)
  lib/
    db.server.js         Turso client singleton + ensureSchema()
    session.server.js    cookie session: getUser/requireUser/createUserSession/logout, isValidEmail
    tmdb.server.js       searchMovies() / trendingMovies()
    lists.server.js      getEntries/addOrUpdateEntry/patchEntry/removeEntry (DB ops)
    useListActions.js    client hook: fetcher posting to /lists (add/rate/remove)
  routes/
    login.jsx            loader (redirect if signed in) + action (bcrypt check, set cookie)
    register.jsx         loader + action (create user, set cookie)
    logout.jsx           action (destroy cookie) — POSTed from Profile
    lists.jsx            action-only resource route: add/rate/remove entries
    app.jsx              PROTECTED LAYOUT: loader = requireUser + getEntries;
                         renders app-shell + BottomNav + <Outlet>. Its loader
                         data (user, entries) is shared by all child pages.
    search.jsx           index route "/": loader does TMDB search(?q=)/trending
    want-to-watch.jsx    thin wrapper around components/EntryList status=want_to_watch
    watched.jsx          thin wrapper around components/EntryList status=watched
    profile.jsx          reads app-layout loader data; logout Form
  components/
    MovieCard.jsx        shared card for search results AND list items (callback-based, unchanged)
    BottomNav.jsx        mobile-style bottom tab bar
    EntryList.jsx        renders watched/want-to-watch list from app-layout loader data

public/
  manifest.webmanifest   PWA manifest (static)
  sw.js                  service worker: installability + TMDB poster caching
  *.png                  generated app icons

react-router.config.js   { ssr: true, presets: [vercelPreset()] }
vite.config.js           reactRouter() plugin + dotenv/config (loads .env into process.env locally)
scripts/                 generate-icons.mjs + icon-source.svg (icon regeneration only)
```

## How data flows (important)

- **Reading**: the `app.jsx` layout loader loads the user + all their
  `movie_entries` once. Child pages (search, watched, want-to-watch, profile)
  read that via `useRouteLoaderData('routes/app')` — they do NOT fetch it
  themselves. Search additionally has its own loader for TMDB results.
- **Writing**: mutations go through the `/lists` resource route action via the
  `useListActions()` hook (a `useFetcher`). After the action runs, React Router
  **automatically revalidates the layout loader**, so lists refresh with no
  manual state management. There is no client-side list cache/context any more
  (the old `ListsContext`/`AuthContext`/`src/api/client.js` are gone).
- **Auth guard**: `requireUser(request)` in a loader throws a redirect to
  `/login?redirectTo=…` when the session cookie is missing. `app.jsx` guards
  every page under it.

## Data model

Single table `movie_entries` (see `app/lib/db.server.js` for the exact DDL):

- `UNIQUE(user_id, tmdb_id)` — one entry per movie per user. Adding a movie
  already in the other list uses `ON CONFLICT DO UPDATE` to flip its `status`,
  never creating a duplicate.
- `status` is `'watched'` or `'want_to_watch'` (CHECK constraint).
- `watched_at` is set when status becomes `'watched'`, cleared otherwise.
- `rating` (1–5) only makes sense for watched entries; the UI only shows stars
  on the Watched tab.

## Environment variables

See `.env.example`. Required: `TMDB_API_KEY`, `TURSO_DATABASE_URL`,
`TURSO_AUTH_TOKEN`, `JWT_SECRET` (now used to sign the session cookie). These
belong to the user's own accounts — never invent or guess values. Locally,
`vite.config.js` loads `.env` into `process.env` via `dotenv/config`; on Vercel
these come from the project's environment variables.

## Commands

| Command            | What it does                                                        |
| ------------------ | ------------------------------------------------------------------- |
| `npm install`      | install deps                                                        |
| `npm run dev`      | **single** dev server (SSR + HMR) — frontend and loaders/actions together |
| `npm run build`    | `react-router build` — client + server bundles                      |
| `npm start`        | serve the production build locally (`react-router-serve`)           |
| `npm run typegen`  | generate route types into `.react-router/`                          |
| `npm run lint`     | oxlint                                                              |

One command, one port now — there is no separate `dev:api` server, no `/api`
proxy, and no `scripts/dev-server.mjs` any more.

## Gotchas / conventions

- **Server vs client code**: anything importing the DB, session, or a secret
  must be in a `*.server.js` file (or a route `loader`/`action`). React Router
  strips server-only modules from the client bundle by the `.server.js`
  suffix — don't import them from a component render path.
- **New pages**: add the file under `app/routes/`, register it in
  `app/routes.js`. Protected pages go inside the `app.jsx` layout children so
  they inherit the auth guard + entries loader.
- **List mutations from the UI**: use `useListActions()` — don't hand-roll
  fetches. Adding/rating/removing all POST to the `/lists` action, which
  triggers loader revalidation.
- **Auth in a loader/action**: `requireUser(request)` (throws redirect) or
  `getUser(request)` (returns null). Never trust a client value for identity.
- **Icons** in `public/*.png` are generated. To change them, edit
  `scripts/icon-source.svg`, then
  `npm install -D sharp && node scripts/generate-icons.mjs && npm uninstall sharp`.

## Rules for agents working in this repo

- Never run commands that log into or link third-party accounts (`vercel
  login`, `vercel link`, `turso auth login`, `gh auth login`, etc.) without the
  user explicitly asking. (Codified in `opencode.json` as `"ask"`.)
- Never deploy (`vercel --prod`, `vercel deploy`) or `git push` without an
  explicit request. (Also `"ask"` in `opencode.json`.)
- Don't commit `.env` (gitignored) — only `.env.example`, with placeholder
  values only.

## Status

Migrated from the original React SPA + Vercel serverless `/api` layout to
React Router v7 framework mode (httpOnly cookie auth, server loaders/actions).
**Not yet deployed** — deployment needs the user's own TMDB key, Turso
database, and Vercel account/login, documented in `README.md`.

## Known gaps / possible follow-up work

- **PWA offline shell**: `sw.js` provides installability + TMDB poster caching
  only. It does NOT precache the server-rendered app shell, so full offline
  navigation isn't supported. Doing that properly needs build-time asset
  manifest injection (Workbox) wired into the SSR build.
- No dedicated movie detail page/route.
- No password reset flow.
- No pagination UI for search results (loader requests page 1 only).
