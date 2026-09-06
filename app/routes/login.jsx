import bcrypt from 'bcryptjs';
import { Form, Link, redirect, useActionData, useNavigation, useSearchParams } from 'react-router';
import { getDb, ensureSchema } from '../lib/db.server.js';
import { createUserSession, getUser, isValidEmail } from '../lib/session.server.js';

export async function loader({ request }) {
  // Already signed in? Skip the form.
  if (await getUser(request)) throw redirect('/');
  return null;
}

export async function action({ request }) {
  const form = await request.formData();
  const email = form.get('email');
  const password = form.get('password');
  const redirectTo = form.get('redirectTo') || '/';

  if (!isValidEmail(email) || typeof password !== 'string') {
    return { error: 'Email and password are required' };
  }

  try {
    await ensureSchema();
    const db = getDb();
    const result = await db.execute({
      sql: 'SELECT id, email, password_hash FROM users WHERE email = ?',
      args: [email.toLowerCase()],
    });
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return { error: 'Invalid email or password' };
    }
    return createUserSession(
      { id: Number(user.id), email: user.email },
      typeof redirectTo === 'string' ? redirectTo : '/'
    );
  } catch (err) {
    console.error('login error', err);
    return { error: 'Server error, please try again' };
  }
}

export default function Login() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const submitting = navigation.state === 'submitting';

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">🎬</div>
        <h1>MovieBox</h1>
        <p className="auth-subtitle">Track what you've watched and what's next</p>

        <Form method="post" className="auth-form">
          <input type="hidden" name="redirectTo" value={searchParams.get('redirectTo') || '/'} />
          <input type="email" name="email" placeholder="Email" required autoComplete="email" />
          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            autoComplete="current-password"
          />
          {actionData?.error && <p className="auth-error">{actionData.error}</p>}
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </Form>

        <p className="auth-switch">
          No account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
