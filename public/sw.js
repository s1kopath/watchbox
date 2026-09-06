// Minimal service worker: makes the app installable and caches TMDB poster
// images (cache-first) so lists stay snappy and posters survive offline.
// App data (loaders/actions) always hits the network for freshness.
//
// NOTE: this does not precache the server-rendered app shell, so full offline
// navigation is not supported yet. That needs build-time asset manifest
// injection (Workbox) integrated with the React Router SSR build — a follow-up.
const POSTER_CACHE = 'tmdb-posters-v1';
const MAX_POSTERS = 200;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

async function cachePoster(request) {
  const cache = await caches.open(POSTER_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    // Simple LRU-ish trim so the cache doesn't grow unbounded.
    const keys = await cache.keys();
    if (keys.length > MAX_POSTERS) await cache.delete(keys[0]);
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin === 'https://image.tmdb.org') {
    event.respondWith(cachePoster(request));
  }
});
