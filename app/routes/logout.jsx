import { redirect } from 'react-router';
import { logout } from '../lib/session.server.js';

export async function action({ request }) {
  return logout(request);
}

// Nothing to render — a stray GET just bounces home.
export async function loader() {
  throw redirect('/');
}
