import { useFetcher, useFetchers } from 'react-router';

// Overlays any in-flight /lists submissions onto the loaded entries so the UI
// reflects a click immediately, before the server write + revalidation land.
// Derived purely from React Router fetcher state — no client-side store.
export function useOptimisticEntries(entries) {
  const fetchers = useFetchers();
  const pending = fetchers.filter(
    (f) => f.formData && f.state !== 'idle' && f.formAction === '/lists'
  );
  if (pending.length === 0) return entries;

  const next = entries.map((e) => ({ ...e }));
  for (const f of pending) {
    const fd = f.formData;
    const intent = fd.get('intent');

    if (intent === 'remove') {
      const id = Number(fd.get('id'));
      const i = next.findIndex((e) => e.id === id);
      if (i !== -1) next.splice(i, 1);
    } else if (intent === 'rate') {
      const id = Number(fd.get('id'));
      const entry = next.find((e) => e.id === id);
      if (entry) entry.rating = Number(fd.get('rating'));
    } else if (intent === 'add') {
      const tmdbId = Number(fd.get('tmdb_id'));
      const status = fd.get('status');
      const existing = next.find((e) => e.tmdb_id === tmdbId);
      if (existing) {
        existing.status = status;
      } else {
        next.push({
          id: `optimistic-${tmdbId}`,
          tmdb_id: tmdbId,
          title: fd.get('title'),
          poster_path: fd.get('poster_path') || null,
          release_date: fd.get('release_date') || null,
          overview: fd.get('overview') || null,
          vote_average: fd.get('vote_average') ? Number(fd.get('vote_average')) : null,
          status,
          rating: null,
        });
      }
    }
  }
  return next;
}

// Wraps a fetcher posting to the /lists action. Callbacks match the shapes the
// old ListsContext exposed, so MovieCard stays unchanged. After each submit,
// React Router revalidates the app layout loader and the lists refresh.
export function useListActions() {
  const fetcher = useFetcher();

  const submit = (fields) => {
    const data = {};
    for (const [k, v] of Object.entries(fields)) data[k] = v == null ? '' : String(v);
    fetcher.submit(data, { method: 'post', action: '/lists' });
  };

  const addOrUpdate = (movie, status) =>
    submit({
      intent: 'add',
      tmdb_id: movie.id,
      title: movie.title,
      poster_path: movie.poster_path,
      release_date: movie.release_date,
      overview: movie.overview,
      vote_average: movie.vote_average,
      status,
    });

  const rate = (id, rating) => submit({ intent: 'rate', id, rating });
  const remove = (id) => submit({ intent: 'remove', id });

  return { addOrUpdate, rate, remove, busy: fetcher.state !== 'idle' };
}
