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
    db.server.js         Turso client singleton + ensureSchema() (tables + list index)
    session.server.js    cookie session: getUser/requireUser/createUserSession/logout, isValidEmail
    tmdb.server.js       searchMovies/trendingMovies/getMovieDetails + short-lived response cache
    lists.server.js      addOrUpdateEntry/patchEntry/removeEntry + paginated reads
                         (getEntriesPage keyset/offset, getCounts, getStatusFor)
    useListActions.js    client hooks: useListActions (fetcher → /lists) + useOptimisticEntries
  routes/
    login.jsx            loader (redirect if signed in) + action (bcrypt check, set cookie)
    register.jsx         loader + action (create user, set cookie)
    logout.jsx           action (destroy cookie) — POSTed from Profile
    lists.jsx            action-only resource route: add/rate/remove entries
    app.jsx              PROTECTED LAYOUT: loader = requireUser only (identity, no DB);
                         renders app-shell + BottomNav + <Outlet>. shouldRevalidate=false.
    search.jsx           index route "/": loader streams TMDB search(?q=)/trending +
                         getStatusFor for the visible results
    want-to-watch.jsx    loader = getEntriesPage(status=want_to_watch); renders EntryList
    watched.jsx          loader = getEntriesPage(status=watched); renders EntryList
    movie.jsx            "movie/:id" details: streams getMovieDetails + status; trailer/cast
    profile.jsx          own loader = getCounts; user from app-layout; logout Form
  components/
    MovieCard.jsx        shared card for search results AND list items (poster/title link to details)
    BottomNav.jsx        mobile-style bottom tab bar
    EntryList.jsx        paginated list: streaming skeleton, infinite scroll (IntersectionObserver
                         + fetcher), in-list title search + sort, optimistic overlay
    Skeleton.jsx         shimmer loading placeholders (card/list/profile/details)
    Icon.jsx             dependency-free inline SVG icon set (currentColor)

public/
  manifest.webmanifest   PWA manifest (static)
  sw.js                  service worker: installability + TMDB poster caching
  tmdb-logo.svg          official TMDB attribution logo (shown on Profile)
  *.png                  generated app icons

react-router.config.js   { ssr: true, presets: [vercelPreset()] }
vite.config.js           reactRouter() plugin + dotenv/config (loads .env into process.env locally)
scripts/                 generate-icons.mjs + icon-source.svg (icon regeneration only)
```

## How data flows (important)

- **Reading (per-page, scoped, paginated)**: the `app.jsx` layout loader loads
  only the **user** (identity from the cookie — no DB). Each page owns its data
  via its own `loader`:
  - `watched` / `want-to-watch` → `getEntriesPage(userId, {status, q, sort,
    cursor})` — one page (24) at a time. Recency uses **keyset** pagination on
    `(added_at, id)`; the optional rating/title sorts use offset. `EntryList`
    does infinite scroll (an `IntersectionObserver` sentinel fires a
    `useFetcher().load('?cursor=…')`) and offers in-list title search + sort.
  - `profile` → `getCounts` (a `COUNT(*) GROUP BY status`, not row loading).
  - `search` → streams TMDB results + `getStatusFor(userId, visibleIds)` for
    just the ~20 shown movies.
  - `movie/:id` → streams `getMovieDetails` + `getStatusFor` for the one movie.
  - No page loads the whole library, so cost is flat as the library grows.
- **Streaming + skeletons**: loaders return their data as an **un-awaited
  promise**; routes render immediately and show `<Suspense>`/`<Await>`
  skeletons (`components/Skeleton.jsx`) until it resolves.
- **Writing**: mutations go through the `/lists` resource route action via the
  `useListActions()` hook (a `useFetcher`). After the action runs, React Router
  **auto-revalidates the active loaders**; `useOptimisticEntries` overlays the
  in-flight change so the UI updates instantly in the meantime. There is no
  client-side list cache/context (the old `ListsContext`/`AuthContext`/
  `src/api/client.js` are gone).
- **Revalidation control**: `app.jsx` `shouldRevalidate=false` (identity is
  fixed for the session); `search.jsx` re-runs only on `?q=` change or after a
  mutation (badges) — TMDB is served from the `tmdb.server.js` cache so that
  costs no network.
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
  on the Watched and details pages.
- Index `idx_entries_user_status_added (user_id, status, added_at DESC, id DESC)`
  serves the paginated list query (filter by user+status, order by recency).

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
| `npm test`         | **offline** smoke test of the server layer (SQLite temp file, no network) |
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
  they inherit the auth guard; give each its own `loader` for the data it needs.
- **List mutations from the UI**: use `useListActions()` — don't hand-roll
  fetches. Adding/rating/removing all POST to the `/lists` action, which
  triggers loader revalidation. For instant feedback overlay pending changes
  with `useOptimisticEntries`.
- **Loaders should stream** (return an un-awaited promise) and be consumed with
  `<Suspense>` + `<Await>` and a skeleton from `components/Skeleton.jsx`, so the
  page never blocks on the network before rendering.
- **Auth in a loader/action**: `requireUser(request)` (throws redirect) or
  `getUser(request)` (returns null). Never trust a client value for identity.
- **Icons** in `public/*.png` are generated. To change them, edit
  `scripts/icon-source.svg`, then
  `npm install --no-save sharp && node scripts/generate-icons.mjs`. In-app UI
  icons are inline SVG in `components/Icon.jsx` (add a new entry to its map).
- **TMDB terms**: attribution + logo are shown on Profile (`public/tmdb-logo.svg`);
  movie/details data is fetched live per view (cached ~5 min), never persisted
  long-term; usage is non-commercial only.

## Rules for agents working in this repo

- **Never commit automatically.** Do the work, verify it, then stop and let the
  user review. Only run `git commit` when the user explicitly asks for it — do
  not commit as a side effect of completing a task. Approving the *work* (a
  "yes" to a proposed change) is NOT approval to commit; wait for an explicit
  commit request.
- Never run commands that log into or link third-party accounts (`vercel
  login`, `vercel link`, `turso auth login`, `gh auth login`, etc.) without the
  user explicitly asking. (Codified in `opencode.json` as `"ask"`.)
- Never deploy (`vercel --prod`, `vercel deploy`) or `git push` without an
  explicit request. (Also `"ask"` in `opencode.json`.)
- Don't commit `.env` (gitignored) — only `.env.example`, with placeholder
  values only.
- **Keep the docs current.** Whenever a change touches architecture, data flow,
  routes, the data model, commands, or conventions, update `AGENTS.md` **and**
  `CLAUDE.md` in the same change so the docs never lag the code.

## Status

Migrated from the original React SPA + Vercel serverless `/api` layout to
React Router v7 framework mode (httpOnly cookie auth, server loaders/actions).
Lists are paginated with streaming skeletons, optimistic UI, in-list
search/sort, and a movie details page (trailer + cast). **Not yet deployed** —
deployment needs the user's own TMDB key, Turso database, and Vercel
account/login, documented in `README.md`.

## Known gaps / possible follow-up work

- **PWA offline shell**: `sw.js` provides installability + TMDB poster caching
  only. It does NOT precache the server-rendered app shell, so full offline
  navigation isn't supported. Doing that properly needs build-time asset
  manifest injection (Workbox) wired into the SSR build.
- No password reset flow.
- Infinite-scroll lists reset to page 1 after a mutation (deliberate; see the
  data-flow notes) — a smarter in-place merge could preserve deep scroll.
- No error toast when a list mutation fails on the server (optimistic change
  just reverts on revalidation).
- Search results themselves aren't paginated (TMDB page 1 only).
