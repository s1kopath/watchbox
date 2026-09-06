import { redirect } from 'react-router';
import { requireUser } from '../lib/session.server.js';
import { addOrUpdateEntry, patchEntry, removeEntry } from '../lib/lists.server.js';

// Action-only route. Fetchers from any page POST here; on success React Router
// revalidates the app layout loader, so lists refresh with no manual state.
export async function action({ request }) {
  const user = await requireUser(request);
  const form = await request.formData();
  const intent = form.get('intent');

  if (intent === 'add') {
    await addOrUpdateEntry(user.id, {
      tmdb_id: Number(form.get('tmdb_id')),
      title: form.get('title'),
      poster_path: form.get('poster_path') || null,
      release_date: form.get('release_date') || null,
      overview: form.get('overview') || null,
      vote_average: form.get('vote_average') ? Number(form.get('vote_average')) : null,
      status: form.get('status'),
    });
    return { ok: true };
  }

  if (intent === 'rate') {
    await patchEntry(user.id, Number(form.get('id')), { rating: Number(form.get('rating')) });
    return { ok: true };
  }

  if (intent === 'remove') {
    await removeEntry(user.id, Number(form.get('id')));
    return { ok: true };
  }

  throw new Response('Unknown intent', { status: 400 });
}

export async function loader() {
  throw redirect('/');
}
