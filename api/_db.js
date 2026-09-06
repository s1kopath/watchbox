import { createClient } from '@libsql/client';

let client;
let schemaReady;

export function getDb() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url) {
      throw new Error('TURSO_DATABASE_URL is not set');
    }
    client = createClient({ url, authToken });
  }
  return client;
}

// Creates tables on first use. libSQL/SQLite is fine running this on every
// cold start since it's all IF NOT EXISTS - cheap and idempotent.
export async function ensureSchema() {
  if (schemaReady) return schemaReady;
  const db = getDb();
  schemaReady = (async () => {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS movie_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tmdb_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        poster_path TEXT,
        release_date TEXT,
        overview TEXT,
        vote_average REAL,
        status TEXT NOT NULL CHECK(status IN ('watched','want_to_watch')),
        rating INTEGER,
        added_at TEXT DEFAULT CURRENT_TIMESTAMP,
        watched_at TEXT,
        UNIQUE(user_id, tmdb_id)
      )
    `);
  })();
  return schemaReady;
}
