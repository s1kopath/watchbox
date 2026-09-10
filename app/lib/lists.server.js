import { getDb, ensureSchema } from './db.server.js';

export const PAGE_SIZE = 24;

export async function getEntries(userId) {
  await ensureSchema();
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM movie_entries WHERE user_id = ? ORDER BY added_at DESC',
    args: [userId],
  });
  return result.rows;
}

// Opaque cursor helpers. For recency paging the cursor is the (added_at, id) of
// the last row (keyset); for the optional sorts it's an offset.
function encodeCursor(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}
function decodeCursor(str) {
  if (!str) return null;
  try {
    return JSON.parse(Buffer.from(str, 'base64url').toString());
  } catch {
    return null;
  }
}

// Turns a user search term into a safe LIKE pattern (escapes % _ and \).
function likePattern(q) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

const SORTS = {
  added: { keyset: true, orderBy: 'added_at DESC, id DESC' },
  rating: { keyset: false, orderBy: 'rating IS NULL, rating DESC, id DESC' },
  title: { keyset: false, orderBy: 'title COLLATE NOCASE ASC, id ASC' },
};

// One page of a user's list, filtered by status (+ optional title search) and
// sorted. Reads PAGE_SIZE+1 rows to know whether another page exists. Returns
// { items, nextCursor }. nextCursor is null when the list is exhausted.
export async function getEntriesPage(
  userId,
  { status, q = '', sort = 'added', cursor = null, limit = PAGE_SIZE } = {}
) {
  if (!['watched', 'want_to_watch'].includes(status)) {
    throw new Response('invalid status', { status: 400 });
  }
  const sortSpec = SORTS[sort] || SORTS.added;
  await ensureSchema();
  const db = getDb();

  const where = ['user_id = ?', 'status = ?'];
  const args = [userId, status];

  const term = q.trim();
  if (term) {
    where.push("title LIKE ? ESCAPE '\\'");
    args.push(likePattern(term));
  }

  const decoded = decodeCursor(cursor);
  let offset = 0;
  if (sortSpec.keyset) {
    if (decoded && decoded.a != null && decoded.i != null) {
      // (added_at, id) < cursor — the DESC keyset boundary.
      where.push('(added_at < ? OR (added_at = ? AND id < ?))');
      args.push(decoded.a, decoded.a, decoded.i);
    }
  } else if (decoded && typeof decoded.o === 'number') {
    offset = decoded.o;
  }

  args.push(limit + 1);
  let sql = `SELECT * FROM movie_entries WHERE ${where.join(' AND ')} ORDER BY ${sortSpec.orderBy} LIMIT ?`;
  if (!sortSpec.keyset) {
    sql += ' OFFSET ?';
    args.push(offset);
  }

  const result = await db.execute({ sql, args });
  const rows = result.rows;
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  let nextCursor = null;
  if (hasMore) {
    if (sortSpec.keyset) {
      const last = items[items.length - 1];
      nextCursor = encodeCursor({ a: last.added_at, i: last.id });
    } else {
      nextCursor = encodeCursor({ o: offset + limit });
    }
  }

  return { items, nextCursor };
}

// Per-status counts without loading rows. Cheap even at tens of thousands.
export async function getCounts(userId) {
  await ensureSchema();
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT status, COUNT(*) AS n FROM movie_entries WHERE user_id = ? GROUP BY status',
    args: [userId],
  });
  const counts = { watched: 0, want_to_watch: 0, total: 0 };
  for (const row of result.rows) {
    counts[row.status] = Number(row.n);
    counts.total += Number(row.n);
  }
  return counts;
}

// Status/rating for a specific set of tmdb ids (the ~20 movies visible on the
// search page). Scales with the page, not the library. Returns an object keyed
// by tmdb_id.
export async function getStatusFor(userId, tmdbIds) {
  const ids = [...new Set((tmdbIds || []).map(Number).filter(Number.isFinite))];
  if (ids.length === 0) return {};
  await ensureSchema();
  const db = getDb();
  const placeholders = ids.map(() => '?').join(', ');
  const result = await db.execute({
    sql: `SELECT id, tmdb_id, status, rating FROM movie_entries
          WHERE user_id = ? AND tmdb_id IN (${placeholders})`,
    args: [userId, ...ids],
  });
  const map = {};
  for (const row of result.rows) map[row.tmdb_id] = row;
  return map;
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
