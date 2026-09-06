import { useEffect, useRef } from 'react';
import { Form, useLoaderData, useNavigation, useRouteLoaderData, useSubmit } from 'react-router';
import { requireUser } from '../lib/session.server.js';
import { searchMovies, trendingMovies } from '../lib/tmdb.server.js';
import MovieCard from '../components/MovieCard.jsx';
import { useListActions } from '../lib/useListActions.js';

export async function loader({ request }) {
  await requireUser(request);
  const q = new URL(request.url).searchParams.get('q')?.trim() || '';
  const data = q ? await searchMovies(q) : await trendingMovies();
  return {
    query: q,
    heading: q ? `Results for "${q}"` : 'Trending this week',
    results: data.results || [],
  };
}

export default function Search() {
  const { query, heading, results } = useLoaderData();
  const { entries } = useRouteLoaderData('routes/app');
  const { addOrUpdate } = useListActions();
  const submit = useSubmit();
  const navigation = useNavigation();
  const debounceRef = useRef();

  const searching = navigation.state === 'loading' && navigation.location?.pathname === '/';

  const byTmdbId = (id) => entries.find((e) => e.tmdb_id === id);

  // Debounce typing into a GET navigation that updates ?q= and re-runs the loader.
  function handleChange(e) {
    const form = e.currentTarget.form;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      submit(form, { replace: true });
    }, 400);
  }

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>Search Movies</h1>
      </header>

      <Form method="get" className="search-bar" role="search">
        <input
          type="search"
          name="q"
          placeholder="Search for a movie…"
          defaultValue={query}
          onChange={handleChange}
          aria-label="Search for a movie"
        />
      </Form>

      <h2 className="section-label">{heading}</h2>

      {searching && <p className="muted">Loading…</p>}

      <div className="movie-list">
        {results.map((movie) => {
          const existing = byTmdbId(movie.id);
          return (
            <MovieCard
              key={movie.id}
              title={movie.title}
              posterPath={movie.poster_path}
              releaseDate={movie.release_date}
              overview={movie.overview}
              voteAverage={movie.vote_average}
              status={existing?.status}
              onAddWant={() => addOrUpdate(movie, 'want_to_watch')}
              onAddWatched={() => addOrUpdate(movie, 'watched')}
            />
          );
        })}
        {!searching && results.length === 0 && <p className="muted">No movies found.</p>}
      </div>
    </div>
  );
}
