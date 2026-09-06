import { getDb, ensureSchema } from './db.server.js';

export async function getEntries(userId) {
  await ensureSchema();
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM movie_entries WHERE user_id = ? ORDER BY added_at DESC',
    args: [userId],
  });
  return result.rows;
}

export async function addOrUpdateEntry(userId, movie) {
  const { tmdb_id, title, poster_path = null, release_date = null, overview = null, vote_average = null, status } = movie;
  if (!tmdb_id || !title || !status) {
    throw new Response('tmdb_id, title and status are required', { status: 400 });
  }
  if (!['watched', 'want_to_watch'].includes(status)) {
    throw new Response('status must be "watched" or "want_to_watch"', { status: 400 });
  }

  await ensureSchema();
  const db = getDb();
  const watchedAt = status === 'watched' ? new Date().toISOString() : null;
  await db.execute({
    sql: `INSERT INTO movie_entries
            (user_id, tmdb_id, title, poster_path, release_date, overview, vote_average, status, watched_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, tmdb_id) DO UPDATE SET
            status = excluded.status,
            watched_at = excluded.watched_at`,
    args: [userId, tmdb_id, title, poster_path, release_date, overview, vote_average, status, watchedAt],
  });
}

export async function patchEntry(userId, id, { status, rating }) {
  if (status && !['watched', 'want_to_watch'].includes(status)) {
    throw new Response('status must be "watched" or "want_to_watch"', { status: 400 });
  }

  await ensureSchema();
  const db = getDb();
  const existing = await db.execute({
    sql: 'SELECT * FROM movie_entries WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });
  if (existing.rows.length === 0) {
    throw new Response('Entry not found', { status: 404 });
  }
  const current = existing.rows[0];

  const nextStatus = status ?? current.status;
  const nextRating = rating ?? current.rating;
  const nextWatchedAt =
    nextStatus === 'watched' ? current.watched_at || new Date().toISOString() : null;

  await db.execute({
    sql: 'UPDATE movie_entries SET status = ?, rating = ?, watched_at = ? WHERE id = ? AND user_id = ?',
    args: [nextStatus, nextRating, nextWatchedAt, id, userId],
  });
}

export async function removeEntry(userId, id) {
  await ensureSchema();
  const db = getDb();
  await db.execute({
    sql: 'DELETE FROM movie_entries WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });
}
