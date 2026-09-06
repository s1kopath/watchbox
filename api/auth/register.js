import bcrypt from 'bcryptjs';
import { getDb, ensureSchema } from '../_db.js';
import { signToken, isValidEmail } from '../_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body || {};

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'A valid email is required' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    await ensureSchema();
    const db = getDb();

    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [email.toLowerCase()],
    });
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'That email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.execute({
      sql: 'INSERT INTO users (email, password_hash) VALUES (?, ?)',
      args: [email.toLowerCase(), passwordHash],
    });

    const userId = Number(result.lastInsertRowid);
    const token = signToken({ userId, email: email.toLowerCase() });
    return res.status(201).json({ token, user: { id: userId, email: email.toLowerCase() } });
  } catch (err) {
    console.error('register error', err);
    return res.status(500).json({ error: 'Server error, please try again' });
  }
}
