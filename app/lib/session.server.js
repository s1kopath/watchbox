import { createCookieSessionStorage, redirect } from 'react-router';

const secret = process.env.JWT_SECRET;
if (!secret) {
  // Fail loud at boot rather than silently signing with an empty secret.
  throw new Error('JWT_SECRET is not set (used to sign the session cookie)');
}

const storage = createCookieSessionStorage({
  cookie: {
    name: 'movielist_session',
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secrets: [secret],
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
});

function getSession(request) {
  return storage.getSession(request.headers.get('Cookie'));
}

// Creates a session cookie for the user and redirects. Mirrors the old
// login/register handlers that returned a token + user.
export async function createUserSession(user, redirectTo = '/') {
  const session = await storage.getSession();
  session.set('userId', user.id);
  session.set('email', user.email);
  return redirect(redirectTo, {
    headers: { 'Set-Cookie': await storage.commitSession(session) },
  });
}

// Returns { id, email } or null. No DB lookup needed — the cookie is signed.
export async function getUser(request) {
  const session = await getSession(request);
  const userId = session.get('userId');
  const email = session.get('email');
  if (typeof userId !== 'number' || !email) return null;
  return { id: userId, email };
}

// Guards protected routes. Throws a redirect to /login when signed out.
export async function requireUser(request) {
  const user = await getUser(request);
  if (!user) {
    const url = new URL(request.url);
    const params = new URLSearchParams({ redirectTo: url.pathname + url.search });
    throw redirect(`/login?${params}`);
  }
  return user;
}

export async function logout(request) {
  const session = await getSession(request);
  return redirect('/login', {
    headers: { 'Set-Cookie': await storage.destroySession(session) },
  });
}

export function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
