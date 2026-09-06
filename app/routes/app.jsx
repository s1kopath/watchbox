import { Outlet } from 'react-router';
import { requireUser } from '../lib/session.server.js';
import { getEntries } from '../lib/lists.server.js';
import BottomNav from '../components/BottomNav.jsx';

export async function loader({ request }) {
  const user = await requireUser(request);
  const entries = await getEntries(user.id);
  return { user, entries };
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
