import { useLists } from '../context/ListsContext.jsx';
import MovieCard from '../components/MovieCard.jsx';

export default function MyList({ status }) {
  const { watched, wantToWatch, loading, rate, remove, addOrUpdate } = useLists();
  const entries = status === 'watched' ? watched : wantToWatch;
  const title = status === 'watched' ? 'Watched' : 'Want to Watch';

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>{title}</h1>
      </header>

      {loading && <p className="muted">Loading…</p>}

      <div className="movie-list">
        {entries.map((entry) => (
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
              status === 'watched'
                ? () =>
                    addOrUpdate(
                      { id: entry.tmdb_id, title: entry.title, poster_path: entry.poster_path,
                        release_date: entry.release_date, overview: entry.overview,
                        vote_average: entry.vote_average },
                      'want_to_watch'
                    )
                : undefined
            }
            onAddWatched={
              status === 'want_to_watch'
                ? () =>
                    addOrUpdate(
                      { id: entry.tmdb_id, title: entry.title, poster_path: entry.poster_path,
                        release_date: entry.release_date, overview: entry.overview,
                        vote_average: entry.vote_average },
                      'watched'
                    )
                : undefined
            }
            onRemove={() => remove(entry.id)}
          />
        ))}
        {!loading && entries.length === 0 && (
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
