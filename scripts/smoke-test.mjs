// Offline smoke test for the server layer — no Turso, no Vercel, no network.
// Points the DB at a temp local SQLite file and exercises the list CRUD ops
// plus the session-cookie round-trip. Runs in well under a second.
//
// Run with: npm test
//
// IMPORTANT (ESM env hoisting): the env vars below MUST be set before the
// dynamic imports, because the *.server.js modules read process.env at import
// time (getDb() and the session storage secret). Do not convert these to
// static top-of-file imports — that reintroduces the "secret is not set" bug.

import { rmSync } from 'node:fs';

const DB_FILE = new URL('./.tmp-smoke.db', import.meta.url).pathname;
const cleanup = () => {
  for (const s of ['', '-wal', '-shm']) {
    try {
      rmSync(DB_FILE + s);
    } catch {
      /* ignore */
    }
  }
};

process.env.TURSO_DATABASE_URL = `file:${DB_FILE}`;
process.env.TURSO_AUTH_TOKEN = '';
process.env.JWT_SECRET = 'smoke-test-secret';
process.env.TMDB_API_KEY = 'not-used-in-this-test';
cleanup();

const { getEntries, addOrUpdateEntry, patchEntry, removeEntry } = await import(
  '../app/lib/lists.server.js'
);
const { createUserSession, getUser, isValidEmail } = await import('../app/lib/session.server.js');
const { getDb, ensureSchema } = await import('../app/lib/db.server.js');

// Seed users so movie_entries' FK (user_id -> users.id) is satisfied.
await ensureSchema();
await getDb().execute(
  "INSERT INTO users (id, email, password_hash) VALUES (1, 'a@test.co', 'x'), (2, 'b@test.co', 'x')"
);

let passed = 0;
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  passed++;
  console.log('  ✓', msg);
}

try {
  const USER = 1;

  // --- list CRUD ---
  await addOrUpdateEntry(USER, { tmdb_id: 27205, title: 'Inception', status: 'want_to_watch' });
  let entries = await getEntries(USER);
  assert(entries.length === 1 && entries[0].status === 'want_to_watch', 'add creates a want_to_watch entry');

  await addOrUpdateEntry(USER, { tmdb_id: 27205, title: 'Inception', status: 'watched' });
  entries = await getEntries(USER);
  assert(entries.length === 1 && entries[0].status === 'watched', 'upsert flips status without duplicating (UNIQUE user_id,tmdb_id)');
  assert(!!entries[0].watched_at, 'watched_at is set when marked watched');

  const id = entries[0].id;
  await patchEntry(USER, id, { rating: 5 });
  entries = await getEntries(USER);
  assert(entries[0].rating === 5, 'patch sets rating');

  await removeEntry(USER, id);
  assert((await getEntries(USER)).length === 0, 'remove deletes the entry');

  await addOrUpdateEntry(2, { tmdb_id: 1, title: 'Other', status: 'watched' });
  assert((await getEntries(USER)).length === 0, 'entries are scoped per user');

  // --- validation ---
  assert(isValidEmail('a@b.co') && !isValidEmail('nope'), 'isValidEmail validates');
  let threw = false;
  try {
    await addOrUpdateEntry(USER, { tmdb_id: 5, title: 'Bad', status: 'invalid' });
  } catch {
    threw = true;
  }
  assert(threw, 'invalid status is rejected');

  // --- session cookie round-trip ---
  const res = await createUserSession({ id: 42, email: 'x@y.co' }, '/');
  const setCookie = res.headers.get('Set-Cookie');
  assert(!!setCookie && setCookie.includes('HttpOnly'), 'session cookie is HttpOnly');
  const req = new Request('http://localhost/', { headers: { Cookie: setCookie.split(';')[0] } });
  const user = await getUser(req);
  assert(user?.id === 42 && user?.email === 'x@y.co', 'getUser reads back the signed cookie');
  assert((await getUser(new Request('http://localhost/'))) === null, 'getUser returns null without a cookie');

  console.log(`\n✅ ${passed} checks passed`);
} catch (err) {
  console.error('\n❌ FAILED:', err.message);
  process.exitCode = 1;
} finally {
  cleanup();
}
