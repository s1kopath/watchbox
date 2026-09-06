// Offline smoke test for the /api handlers.
// Uses a local sqlite file via @libsql/client (no network, no external accounts).
// Run with: node scripts/test-api-local.mjs

import { unlink } from 'node:fs/promises';

// Must be set before the api modules are imported (dynamic import below),
// since ESM hoists static imports above other top-level code.
process.env.TURSO_DATABASE_URL = 'file:./scripts/.tmp-test.db';
process.env.TURSO_AUTH_TOKEN = '';
process.env.JWT_SECRET = 'local-test-secret';

const { default: registerHandler } = await import('../api/auth/register.js');
const { default: loginHandler } = await import('../api/auth/login.js');
const { default: listsIndexHandler } = await import('../api/lists/index.js');
const { default: listsIdHandler } = await import('../api/lists/[id].js');

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
    },
  };
  return res;
}

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.error('FAIL:', msg);
  } else {
    console.log('ok  :', msg);
  }
}

async function main() {
  await unlink('./scripts/.tmp-test.db').catch(() => {});

  // Register
  let res = mockRes();
  await registerHandler({ method: 'POST', body: { email: 'test@example.com', password: 'secret123' }, headers: {} }, res);
  assert(res.statusCode === 201, `register returns 201 (got ${res.statusCode}, ${JSON.stringify(res.body)})`);
  const token = res.body?.token;
  assert(typeof token === 'string' && token.length > 10, 'register returns a token');

  // Duplicate register should fail
  res = mockRes();
  await registerHandler({ method: 'POST', body: { email: 'test@example.com', password: 'secret123' }, headers: {} }, res);
  assert(res.statusCode === 409, `duplicate register returns 409 (got ${res.statusCode})`);

  // Login with wrong password
  res = mockRes();
  await loginHandler({ method: 'POST', body: { email: 'test@example.com', password: 'wrongpass' }, headers: {} }, res);
  assert(res.statusCode === 401, `login with wrong password returns 401 (got ${res.statusCode})`);

  // Login correctly
  res = mockRes();
  await loginHandler({ method: 'POST', body: { email: 'test@example.com', password: 'secret123' }, headers: {} }, res);
  assert(res.statusCode === 200, `login returns 200 (got ${res.statusCode})`);
  const authHeaders = { authorization: `Bearer ${res.body.token}` };

  // No auth -> lists GET should 401
  res = mockRes();
  await listsIndexHandler({ method: 'GET', headers: {} }, res);
  assert(res.statusCode === 401, `lists GET without auth returns 401 (got ${res.statusCode})`);

  // Add a "want to watch" entry
  res = mockRes();
  await listsIndexHandler(
    {
      method: 'POST',
      headers: authHeaders,
      body: {
        tmdb_id: 550,
        title: 'Fight Club',
        poster_path: '/poster.jpg',
        release_date: '1999-10-15',
        overview: 'A film.',
        vote_average: 8.4,
        status: 'want_to_watch',
      },
    },
    res
  );
  assert(res.statusCode === 201, `add entry returns 201 (got ${res.statusCode}, ${JSON.stringify(res.body)})`);

  // Fetch list, expect 1 entry
  res = mockRes();
  await listsIndexHandler({ method: 'GET', headers: authHeaders }, res);
  assert(res.statusCode === 200, 'get entries returns 200');
  assert(res.body.entries.length === 1, `entries has 1 item (got ${res.body.entries.length})`);
  const entryId = res.body.entries[0].id;
  assert(res.body.entries[0].status === 'want_to_watch', 'entry status is want_to_watch');

  // Move to watched + rate it
  res = mockRes();
  await listsIdHandler(
    { method: 'PATCH', headers: authHeaders, query: { id: entryId }, body: { status: 'watched', rating: 5 } },
    res
  );
  assert(res.statusCode === 200, `patch to watched returns 200 (got ${res.statusCode}, ${JSON.stringify(res.body)})`);

  res = mockRes();
  await listsIndexHandler({ method: 'GET', headers: authHeaders }, res);
  assert(res.body.entries[0].status === 'watched', 'entry status updated to watched');
  assert(res.body.entries[0].rating === 5, 'entry rating updated to 5');
  assert(!!res.body.entries[0].watched_at, 'watched_at is set');

  // Delete it
  res = mockRes();
  await listsIdHandler({ method: 'DELETE', headers: authHeaders, query: { id: entryId } }, res);
  assert(res.statusCode === 200, 'delete returns 200');

  res = mockRes();
  await listsIndexHandler({ method: 'GET', headers: authHeaders }, res);
  assert(res.body.entries.length === 0, 'entries empty after delete');

  await unlink('./scripts/.tmp-test.db').catch(() => {});

  console.log('\n' + (failures === 0 ? 'ALL TESTS PASSED' : `${failures} TEST(S) FAILED`));
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Test run crashed:', err);
  process.exit(1);
});
