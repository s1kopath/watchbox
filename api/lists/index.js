import { getDb, ensureSchema } from '../_db.js';
import { getUserFromReq } from '../_auth.js';

export default async function handler(req, res) {
  const user = getUserFromReq(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  await ensureSchema();
  const db = getDb();

  if (req.method === 'GET') {
    const result = await db.execute({
      sql: 'SELECT * FROM movie_entries WHERE user_id = ? ORDER BY added_at DESC',
      args: [user.userId],
    });
    return res.status(200).json({ entries: result.rows });
  }

  if (req.method === 'POST') {
    const {
      tmdb_id,
      title,
      poster_path = null,
      release_date = null,
      overview = null,
      vote_average = null,
      status,
    } = req.body || {};

    if (!tmdb_id || !title || !status) {
      return res.status(400).json({ error: 'tmdb_id, title and status are required' });
    }
    if (!['watched', 'want_to_watch'].includes(status)) {
      return res.status(400).json({ error: 'status must be "watched" or "want_to_watch"' });
    }

    try {
      const watchedAt = status === 'watched' ? new Date().toISOString() : null;
      await db.execute({
        sql: `INSERT INTO movie_entries
                (user_id, tmdb_id, title, poster_path, release_date, overview, vote_average, status, watched_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(user_id, tmdb_id) DO UPDATE SET
                status = excluded.status,
                watched_at = excluded.watched_at`,
        args: [
          user.userId,
          tmdb_id,
          title,
          poster_path,
          release_date,
          overview,
          vote_average,
          status,
          watchedAt,
        ],
      });
      return res.status(201).json({ ok: true });
    } catch (err) {
      console.error('add entry error', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
