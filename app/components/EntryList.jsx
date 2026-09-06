import { useRouteLoaderData } from 'react-router';
import MovieCard from './MovieCard.jsx';
import { useListActions } from '../lib/useListActions.js';

export default function EntryList({ status }) {
  const { entries } = useRouteLoaderData('routes/app');
  const { addOrUpdate, rate, remove } = useListActions();

  const list = entries.filter((e) => e.status === status);
  const title = status === 'watched' ? 'Watched' : 'Want to Watch';

  const toMovie = (entry) => ({
    id: entry.tmdb_id,
    title: entry.title,
    poster_path: entry.poster_path,
    release_date: entry.release_date,
    overview: entry.overview,
    vote_average: entry.vote_average,
  });

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>{title}</h1>
      </header>

      <div className="movie-list">
        {list.map((entry) => (
          <MovieCard
            key={entry.id}
            title={entry.title}
            posterPath={entry.poster_path}
            releaseDate={entry.release_date}
            overview={entry.overview}
            voteAverage={entry.vote_average}
            rating={entry.rating}
            status={entry.status}
            onRate={status === 'watched' ? (r) => rate(entry.id, r) : undefined}
            onAddWant={
              status === 'watched' ? () => addOrUpdate(toMovie(entry), 'want_to_watch') : undefined
            }
            onAddWatched={
              status === 'want_to_watch' ? () => addOrUpdate(toMovie(entry), 'watched') : undefined
            }
            onRemove={() => remove(entry.id)}
          />
        ))}
        {list.length === 0 && (
          <p className="muted">
            {status === 'watched'
              ? "You haven't marked anything as watched yet."
              : 'Your want-to-watch list is empty. Go search for movies!'}
          </p>
        )}
      </div>
    </div>
  );
}
