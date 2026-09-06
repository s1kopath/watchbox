# MovieBox

A mobile-app-like PWA for tracking movies you've watched and want to watch.
Search pulls real movie data (posters, ratings, descriptions) from TMDB;
your lists are stored per-account in a free cloud SQLite database (Turso).

- **Framework**: [React Router v7](https://reactrouter.com/) in framework mode
  (SSR) — a single app that serves both the UI and its server data loaders,
  installable as a PWA with a native-app-like bottom tab bar
- **Database**: [Turso](https://turso.tech) — SQLite-compatible, free tier
- **Movie data**: [TMDB API](https://www.themoviedb.org/documentation/api) (key kept server-side, never exposed to the browser)
- **Auth**: email/password with an httpOnly session cookie, so multiple people can each have their own lists
- **Deploy**: [Vercel](https://vercel.com) via the `@vercel/react-router` preset (loaders/actions run as serverless functions)

## 1. Get a free TMDB API key

1. Create a free account at https://www.themoviedb.org
2. Go to Settings → API → request an API key (choose "Developer", personal use)
3. Copy the **API Key (v3 auth)** value

## 2. Create a free Turso database

1. Install the Turso CLI: `curl -sSfL https://get.tur.so/install.sh | bash`
2. Sign up / log in: `turso auth signup` (or `turso auth login`)
3. Create a database: `turso db create moviebox`
4. Get the connection URL: `turso db show moviebox --url`
5. Create an auth token: `turso db tokens create moviebox`

You don't need to create tables manually — the app creates them automatically
on first request (`app/lib/db.server.js`).

## 3. Configure environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

```
TMDB_API_KEY=your_tmdb_key
TURSO_DATABASE_URL=libsql://moviebox-yourname.turso.io
TURSO_AUTH_TOKEN=your_turso_token
JWT_SECRET=any_long_random_string
```

`JWT_SECRET` signs the httpOnly login session cookie. Generate one with:
`openssl rand -hex 32`

## 4. Run locally

```bash
npm install
npm run dev
```

Open the URL it prints (usually http://localhost:5173). That's it — **one
command, one server**. The UI and the server-side loaders/actions run together;
there's no separate API process or proxy to start. The dev server reads `.env`
automatically (via `dotenv` in `vite.config.js`).

To test the production build locally:

```bash
npm run build
npm start
```

## 5. Deploy to Vercel (free)

```bash
npm install -g vercel   # if you don't have the CLI yet
vercel login
vercel                  # first deploy, follow the prompts
vercel --prod           # promote to production
```

Vercel detects the React Router framework automatically (no `vercel.json`
needed). Then add your environment variables in the Vercel dashboard
(Project → Settings → Environment Variables), or via CLI:

```bash
vercel env add TMDB_API_KEY
vercel env add TURSO_DATABASE_URL
vercel env add TURSO_AUTH_TOKEN
vercel env add JWT_SECRET
vercel --prod           # redeploy so the new env vars take effect
```

## 6. Install it like an app

Once deployed, open the site on your phone:

- **Android (Chrome)**: menu → "Install app" / "Add to Home screen"
- **iOS (Safari)**: Share → "Add to Home Screen"

It launches full-screen with its own icon. Posters are cached for offline
viewing; note the app shell itself still needs a connection to load (see the
PWA note in `AGENTS.md`).

## Project structure

```
app/
  root.jsx             HTML shell, service-worker registration, error boundary
  routes.js            route table
  index.css            all styling
  lib/                 server modules (db, session/auth, tmdb, list ops) + useListActions hook
  routes/              login, register, logout, lists (action), app (protected layout),
                       search (index), watched, want-to-watch, profile
  components/          MovieCard, BottomNav, EntryList

public/                manifest.webmanifest, sw.js, generated *.png icons
react-router.config.js SSR + Vercel preset
vite.config.js         React Router plugin + .env loading
scripts/               icon-source.svg + generate-icons.mjs (icon regeneration)
```

See `AGENTS.md` for a deeper explanation of how data flows (loaders, the
`/lists` action, and loader revalidation).

## Regenerating app icons

Icons in `public/` were generated once from `scripts/icon-source.svg`. To
change the icon, edit that SVG, then:

```bash
npm install -D sharp
node scripts/generate-icons.mjs
npm uninstall sharp
```
