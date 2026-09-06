import { getDb, ensureSchema } from '../_db.js';
import { getUserFromReq } from '../_auth.js';

export default async function handler(req, res) {
  const user = getUserFromReq(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;
  await ensureSchema();
  const db = getDb();

  if (req.method === 'PATCH') {
    const { status, rating } = req.body || {};
    if (status && !['watched', 'want_to_watch'].includes(status)) {
      return res.status(400).json({ error: 'status must be "watched" or "want_to_watch"' });
    }

    const existing = await db.execute({
      sql: 'SELECT * FROM movie_entries WHERE id = ? AND user_id = ?',
      args: [id, user.userId],
    });
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    const current = existing.rows[0];

    const nextStatus = status ?? current.status;
    const nextRating = rating ?? current.rating;
    const nextWatchedAt =
      nextStatus === 'watched' ? current.watched_at || new Date().toISOString() : null;

    await db.execute({
      sql: 'UPDATE movie_entries SET status = ?, rating = ?, watched_at = ? WHERE id = ? AND user_id = ?',
      args: [nextStatus, nextRating, nextWatchedAt, id, user.userId],
    });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    await db.execute({
      sql: 'DELETE FROM movie_entries WHERE id = ? AND user_id = ?',
      args: [id, user.userId],
    });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'PATCH, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
