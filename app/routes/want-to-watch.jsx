import { requireUser } from '../lib/session.server.js';
import { getEntriesPage } from '../lib/lists.server.js';
import EntryList from '../components/EntryList.jsx';

export async function loader({ request }) {
  const user = await requireUser(request);
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim() || '';
  const sort = url.searchParams.get('sort') || 'added';
  const cursor = url.searchParams.get('cursor') || null;
  // Stream the first page so the route renders immediately with a skeleton.
  const page = getEntriesPage(user.id, { status: 'want_to_watch', q, sort, cursor });
  return { status: 'want_to_watch', q, sort, page };
}

export default function WantToWatch() {
  return <EntryList />;
}
