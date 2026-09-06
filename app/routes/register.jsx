import bcrypt from 'bcryptjs';
import { Form, Link, redirect, useActionData, useNavigation } from 'react-router';
import { getDb, ensureSchema } from '../lib/db.server.js';
import { createUserSession, getUser, isValidEmail } from '../lib/session.server.js';

export async function loader({ request }) {
  if (await getUser(request)) throw redirect('/');
  return null;
}

export async function action({ request }) {
  const form = await request.formData();
  const email = form.get('email');
  const password = form.get('password');

  if (!isValidEmail(email)) {
    return { error: 'A valid email is required' };
  }
  if (typeof password !== 'string' || password.length < 6) {
    return { error: 'Password must be at least 6 characters' };
  }

  try {
    await ensureSchema();
    const db = getDb();
    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [email.toLowerCase()],
    });
    if (existing.rows.length > 0) {
      return { error: 'That email is already registered' };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.execute({
      sql: 'INSERT INTO users (email, password_hash) VALUES (?, ?)',
      args: [email.toLowerCase(), passwordHash],
    });

    return createUserSession({ id: Number(result.lastInsertRowid), email: email.toLowerCase() });
  } catch (err) {
    console.error('register error', err);
    return { error: 'Server error, please try again' };
  }
}

export default function Register() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const submitting = navigation.state === 'submitting';

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">🎬</div>
        <h1>MovieBox</h1>
        <p className="auth-subtitle">Create your account</p>

        <Form method="post" className="auth-form">
          <input type="email" name="email" placeholder="Email" required autoComplete="email" />
          <input
            type="password"
            name="password"
            placeholder="Password (min 6 characters)"
            required
            minLength={6}
            autoComplete="new-password"
          />
          {actionData?.error && <p className="auth-error">{actionData.error}</p>}
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create Account'}
          </button>
        </Form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
