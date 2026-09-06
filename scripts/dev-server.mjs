// Zero-dependency local server for the api/ serverless handlers.
//
// This exists so local development never needs `vercel dev` (which requires
// linking/logging into a Vercel account). It maps requests to the same
// handler files Vercel runs in production, using the same file-based routing
// convention (folders = path segments, `[id].js` = dynamic segment,
// `index.js` = the folder's own path, `_foo.js` files are ignored).
//
// Run with: node scripts/dev-server.mjs
// (or `npm run dev:api`, which is what `npm run dev`'s Vite proxy expects on
// port 3000 - see vite.config.js server.proxy)

import http from 'node:http';
import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL, URL } from 'node:url';

const PORT = Number(process.env.PORT || 3000);
const API_DIR = path.resolve('api');

function loadDotEnv(file = '.env') {
  if (!existsSync(file)) return;
  for (const rawLine of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotEnv();

function walk(dir, segments = []) {
  const routes = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('_')) continue; // shared helpers, not routes
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      routes.push(...walk(full, [...segments, entry]));
    } else if (entry.endsWith('.js')) {
      routes.push({ file: full, segments: [...segments, entry.slice(0, -3)] });
    }
  }
  return routes;
}

function toMatcher(segment) {
  const dynamic = /^\[(.+)\]$/.exec(segment);
  return dynamic ? { param: dynamic[1] } : { literal: segment };
}

const routeTable = walk(API_DIR).map(({ file, segments }) => {
  const segs = segments[segments.length - 1] === 'index' ? segments.slice(0, -1) : segments;
  return {
    file,
    matchers: segs.map(toMatcher),
    pattern: '/api/' + segs.join('/'),
  };
});

function matchRoute(pathname) {
  const parts = pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  for (const route of routeTable) {
    if (route.matchers.length !== parts.length) continue;
    const params = {};
    const ok = route.matchers.every((matcher, i) => {
      if (matcher.param) {
        params[matcher.param] = decodeURIComponent(parts[i]);
        return true;
      }
      return matcher.literal === parts[i];
    });
    if (ok) return { route, params };
  }
  return null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (!url.pathname.startsWith('/api/')) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  const match = matchRoute(url.pathname);
  if (!match) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: `No API route for ${url.pathname}` }));
    return;
  }

  const query = { ...Object.fromEntries(url.searchParams.entries()), ...match.params };

  let body;
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const raw = await readBody(req);
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      return;
    }
  }

  const mockRes = {
    statusCode: 200,
    _headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, value) {
      this._headers[key] = value;
    },
    json(payload) {
      res.writeHead(this.statusCode, { 'content-type': 'application/json', ...this._headers });
      res.end(JSON.stringify(payload));
    },
  };

  try {
    const mod = await import(pathToFileURL(match.route.file).href);
    await mod.default({ method: req.method, headers: req.headers, query, body }, mockRes);
  } catch (err) {
    console.error(`[dev-server] ${req.method} ${url.pathname} crashed:`, err);
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error (see terminal for details)' }));
  }
});

server.listen(PORT, () => {
  console.log(`API dev server → http://localhost:${PORT}`);
  console.log('Routes:');
  for (const r of routeTable) console.log('  ', r.pattern);
  const missing = ['TMDB_API_KEY', 'TURSO_DATABASE_URL', 'JWT_SECRET'].filter(
    (k) => !process.env[k]
  );
  if (missing.length) {
    console.warn(
      `\n[dev-server] Warning: missing env vars: ${missing.join(', ')}. Copy .env.example to .env and fill them in.`
    );
  }
});
