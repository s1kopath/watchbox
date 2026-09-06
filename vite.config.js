import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
import 'dotenv/config';

// dotenv loads .env into process.env so server loaders/actions can read
// TMDB_API_KEY / TURSO_* / JWT_SECRET during local dev and build. On Vercel
// these come from the project's environment variables instead.
//
// The React Router plugin bundles React fast-refresh, so no separate
// @vitejs/plugin-react is needed. There's also no /api proxy any more — the
// backend lives in route loaders/actions served by the same dev server.
export default defineConfig({
  plugins: [reactRouter()],
});
