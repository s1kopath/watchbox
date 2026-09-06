# CLAUDE.md — start here

MovieBox: a **React Router v7 (framework mode, SSR)** PWA for tracking movies
you've watched / want to watch. Multi-user, movie data from TMDB, per-user
lists in Turso (cloud SQLite). Deploys to Vercel.

This file is the fast-start. **[AGENTS.md](AGENTS.md) is the deep reference** —
read it when you need the full data model, conventions, or gotchas. You should
NOT need to read the whole codebase to make a change; the map below + AGENTS.md
is enough.

## Mental model (the 4 things to know)

1. **No separate backend.** Every page is a route module in `app/routes/` that
   can export a server-only `loader` (read) and `action` (write). Shared
   server code lives in `app/lib/*.server.js`. There is no `/api` folder, no
   proxy, no second dev server.
2. **Auth = httpOnly session cookie** (`app/lib/session.server.js`), signed
   with `JWT_SECRET`. Read it in loaders via `requireUser(request)` (throws a
   redirect to `/login` when signed out) or `getUser(request)`. Never trust a
   client value for identity. No localStorage, no JWT-in-JS.
3. **Reads flow down, writes flow through `/lists`.** The protected layout
   `app/routes/app.jsx` loads the user + all their entries once; child pages
   read that with `useRouteLoaderData('routes/app')`. Mutations POST to the
   `app/routes/lists.jsx` action via the `useListActions()` hook; React Router
   then **auto-revalidates** the loader, so the UI refreshes with no manual
   state. There is no client-side store/context.
4. **Secrets stay server-side.** DB, session, and TMDB key are only touched in
   `*.server.js` / loaders / actions — never in a component render path.

## Where things live

```
app/routes/       login, register, logout, lists(action-only), app(protected layout),
                  search(index "/"), watched, want-to-watch, profile
app/lib/          db.server, session.server, tmdb.server, lists.server (DB ops),
                  useListActions.js (client mutation hook)
app/components/   MovieCard, BottomNav, EntryList
app/root.jsx      HTML shell + service-worker registration + ErrorBoundary
app/routes.js     route table (explicit config)
public/           manifest.webmanifest, sw.js, generated *.png icons
```

## Commands

| Command          | Use                                                          |
| ---------------- | ------------------------------------------------------------ |
| `npm run dev`    | one dev server (UI + loaders/actions), HMR                   |
| `npm test`       | **offline** smoke test of the server layer (~1s, no network) |
| `npm run lint`   | oxlint                                                       |
| `npm run build`  | production build                                             |
| `npm start`      | serve the production build locally                           |

## How to verify a change (do this before saying "done")

- **Server/data change** (anything in `app/lib/*.server.js` or a loader/action):
  run `npm test`. It exercises list CRUD (add/upsert/patch/remove, per-user
  scoping) and the session cookie round-trip against a throwaway local SQLite —
  no Turso/Vercel/account needed.
- **UI/flow change**: `npm run dev` and click through, or drive it with curl
  using a cookie jar (register → get `Set-Cookie` → hit protected routes). The
  `/smoke-test` command documents the full live flow.
- Always run `npm run lint` too.

## Hard rules

- **Never commit automatically.** Make and verify changes, then stop and let
  the user review. Only run `git commit` when the user explicitly asks (e.g.
  "commit this"). Same for staging intent — don't commit as a side effect of
  finishing a task.
- **Do not** `git push`, deploy (`vercel --prod` / `vercel deploy`), or run any
  account login/link (`vercel login`, `turso auth …`, `gh auth …`) without the
  user explicitly asking. (Also codified in `opencode.json`.)
- **Never** invent or hardcode `.env` values (`TMDB_API_KEY`, `TURSO_*`,
  `JWT_SECRET`) — they're the user's real accounts. `.env` is gitignored; only
  `.env.example` (placeholders) is tracked.
- New protected page → add it under the `app.jsx` layout in `app/routes.js` so
  it inherits the auth guard + entries loader.
- List mutation from the UI → use `useListActions()`; don't hand-roll fetches.
- Keep DB/session/secret access in `*.server.js` / loaders / actions only.

## Gotchas

- **ESM env hoisting**: `*.server.js` modules read `process.env` at import
  time. In scripts, set env vars *before* any `await import(...)` of them (see
  the top of `scripts/smoke-test.mjs`).
- Locally, `.env` is loaded into `process.env` by `dotenv/config` in
  `vite.config.js`. On Vercel it comes from project env vars.
- PWA: `public/sw.js` gives installability + poster caching only; the SSR app
  shell is **not** precached (full offline is a known follow-up).
