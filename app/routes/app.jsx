import { Outlet } from 'react-router';
import { requireUser } from '../lib/session.server.js';
import BottomNav from '../components/BottomNav.jsx';

// The layout only provides identity now — no DB read. Each page loads its own
// scoped, paginated slice, so the app's cost no longer grows with library size.
export async function loader({ request }) {
  const user = await requireUser(request);
  return { user };
}

// Identity is fixed for the session; never re-run this on navigation.
export function shouldRevalidate() {
  return false;
}

export default function AppLayout() {
  return (
    <div className="app-shell">
      <main className="app-content">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
