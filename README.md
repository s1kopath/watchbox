# MovieList

A mobile-app-like PWA for tracking movies you've watched and want to watch.
Search pulls real movie data (posters, ratings, descriptions) from TMDB;
your lists are stored per-account in a free cloud SQLite database (Turso).

- **Frontend**: React + Vite, installable as a PWA (works offline for the UI,
  looks/feels like a native mobile app with a bottom tab bar)
- **Backend**: Vercel serverless functions (`/api`)
- **Database**: [Turso](https://turso.tech) — SQLite-compatible, free tier
- **Movie data**: [TMDB API](https://www.themoviedb.org/documentation/api) (key kept server-side, never exposed to the browser)
- **Auth**: email/password with JWT, so multiple people can each have their own lists

## 1. Get a free TMDB API key

1. Create a free account at https://www.themoviedb.org
2. Go to Settings → API → request an API key (choose "Developer", personal use)
3. Copy the **API Key (v3 auth)** value

## 2. Create a free Turso database

1. Install the Turso CLI: `curl -sSfL https://get.tur.so/install.sh | bash`
2. Sign up / log in: `turso auth signup` (or `turso auth login`)
3. Create a database: `turso db create movie-list`
4. Get the connection URL: `turso db show movie-list --url`
5. Create an auth token: `turso db tokens create movie-list`

You don't need to create tables manually — the API creates them automatically
on first request (`api/_db.js`).

## 3. Configure environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

```
TMDB_API_KEY=your_tmdb_key
TURSO_DATABASE_URL=libsql://movie-list-yourname.turso.io
TURSO_AUTH_TOKEN=your_turso_token
JWT_SECRET=any_long_random_string
```

Generate a `JWT_SECRET` quickly with: `openssl rand -hex 32`

## 4. Run locally

Install dependencies:

```bash
npm install
```

You need two things running for full local dev (frontend + API):

```bash
# Terminal 1 - serves the /api serverless functions on port 3000
npx vercel dev --listen 3000

# Terminal 2 - Vite dev server with HMR, proxies /api to port 3000
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

> The first time you run `vercel dev` it may ask you to log in / link the
> project — that's the Vercel CLI's normal setup flow for your own account,
> not something this codebase does automatically.

### Offline smoke test (no accounts needed)

`scripts/test-api-local.mjs` exercises the auth + list API handlers directly
against a temporary local SQLite file — no Turso or Vercel account required:

```bash
node scripts/test-api-local.mjs
```

## 5. Deploy to Vercel (free)

```bash
npm install -g vercel   # if you don't have the CLI yet
vercel login
vercel                  # first deploy, follow the prompts
vercel --prod           # promote to production
```

Then add your environment variables in the Vercel dashboard
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

It will launch full-screen with its own icon, just like a native app.

## Project structure

```
api/                  Vercel serverless functions
  _db.js              Turso client + schema setup
  _auth.js            JWT sign/verify helpers
  auth/register.js    POST /api/auth/register
  auth/login.js       POST /api/auth/login
  movies/search.js    GET  /api/movies/search?q=
  movies/trending.js  GET  /api/movies/trending
  lists/index.js      GET/POST /api/lists
  lists/[id].js        PATCH/DELETE /api/lists/:id

src/
  api/client.js        fetch wrapper (attaches JWT, base /api paths)
  context/             Auth + Lists React context providers
  components/          MovieCard, BottomNav
  pages/               Login, Register, Search, MyList, Profile

scripts/
  icon-source.svg       source art for the app icon
  generate-icons.mjs    regenerates public/*.png from the SVG (needs `sharp`)
  test-api-local.mjs    offline smoke test for the API handlers
```

## Regenerating app icons

Icons in `public/` were generated once from `scripts/icon-source.svg`. If you
want to change the icon, edit that SVG, then:

```bash
npm install -D sharp
node scripts/generate-icons.mjs
npm uninstall sharp
```
