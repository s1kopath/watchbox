const TMDB_BASE = 'https://api.themoviedb.org/3';

// Short-lived in-memory cache. Keyed by request path (never the api_key). Lets
// repeated/near-simultaneous reads — e.g. the loader revalidating after a list
// mutation — reuse a response instead of hitting the network again. Best-effort
// and per-process (fine on Vercel; each instance keeps its own), well under
// TMDB's 6-month caching cap.
const TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 200;
const cache = new Map();

function fromCache(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}

function toCache(key, data) {
  cache.set(key, { at: Date.now(), data });
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

function apiKey() {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Response('TMDB_API_KEY is not configured', { status: 500 });
  return key;
}

// `path` is the cache key + request path (with query, minus the api_key).
async function tmdb(path) {
  const cached = fromCache(path);
  if (cached) return cached;

  const sep = path.includes('?') ? '&' : '?';
  let res;
  try {
    res = await fetch(`${TMDB_BASE}${path}${sep}api_key=${apiKey()}`);
  } catch {
    throw new Response('Failed to reach TMDB', { status: 502 });
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Response(data?.status_message || 'TMDB request failed', { status: res.status });
  }
  toCache(path, data);
  return data;
}

export async function searchMovies(query, page = 1) {
  return tmdb(
    `/search/movie?query=${encodeURIComponent(query)}&page=${encodeURIComponent(
      page
    )}&include_adult=false`
  );
}

export async function trendingMovies() {
  return tmdb('/trending/movie/week');
}
