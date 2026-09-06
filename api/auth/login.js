import bcrypt from 'bcryptjs';
import { getDb, ensureSchema } from '../_db.js';
import { signToken, isValidEmail } from '../_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body || {};

  if (!isValidEmail(email) || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    await ensureSchema();
    const db = getDb();

    const result = await db.execute({
      sql: 'SELECT id, email, password_hash FROM users WHERE email = ?',
      args: [email.toLowerCase()],
    });

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken({ userId: Number(user.id), email: user.email });
    return res.status(200).json({ token, user: { id: Number(user.id), email: user.email } });
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ error: 'Server error, please try again' });
  }
}
