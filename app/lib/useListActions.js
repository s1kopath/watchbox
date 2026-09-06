import { useFetcher } from 'react-router';

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
