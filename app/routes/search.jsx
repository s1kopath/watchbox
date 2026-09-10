import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Await, Form, useLoaderData, useNavigation, useSubmit } from 'react-router';
import { requireUser } from '../lib/session.server.js';
import { searchMovies, trendingMovies } from '../lib/tmdb.server.js';
import { getStatusFor } from '../lib/lists.server.js';
import MovieCard from '../components/MovieCard.jsx';
import { MovieListSkeleton } from '../components/Skeleton.jsx';
import { useListActions, useOptimisticEntries } from '../lib/useListActions.js';

export async function loader({ request }) {
  const user = await requireUser(request);
  const q = new URL(request.url).searchParams.get('q')?.trim() || '';
  // Stream the TMDB results so navigating into search renders immediately with
  // a skeleton, instead of blocking on the network before the page appears.
  const results = (q ? searchMovies(q) : trendingMovies()).then((d) => d.results || []);
  // Look up list status only for the ~20 visible results — scales with the
  // page, not the user's whole library.
  const statuses = results.then((rs) => getStatusFor(user.id, rs.map((r) => r.id)));
  return {
    query: q,
    heading: q ? `Results for "${q}"` : 'Trending this week',
    results,
    statuses,
  };
}

export function shouldRevalidate({ currentUrl, nextUrl, formMethod }) {
  // Re-hit TMDB only when the query changes...
  if (currentUrl.searchParams.get('q') !== nextUrl.searchParams.get('q')) return true;
  // ...but do refresh the "in your list" badges after a mutation. The TMDB
  // results are served from the short-lived cache, so this costs no network.
  return formMethod != null && formMethod.toUpperCase() !== 'GET';
}

export default function Search() {
  const { query, heading, results, statuses } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const debounceRef = useRef();

  const searching = navigation.state === 'loading' && navigation.location?.pathname === '/';

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

      {searching ? (
        <MovieListSkeleton />
      ) : (
        <Suspense fallback={<MovieListSkeleton />}>
          <Await
            resolve={results}
            errorElement={<p className="muted">Couldn’t load movies. Please try again.</p>}
          >
            {(resolvedResults) => (
              <Await resolve={statuses}>
                {(resolvedStatuses) => (
                  <SearchResults results={resolvedResults} statuses={resolvedStatuses} />
                )}
              </Await>
            )}
          </Await>
        </Suspense>
      )}
    </div>
  );
}

function SearchResults({ results, statuses }) {
  // `statuses` is a { tmdb_id: entry } map for the visible results; feed its
  // values through the optimistic overlay so freshly-added movies flip badges
  // instantly.
  const base = useMemo(() => Object.values(statuses), [statuses]);
  const optimisticEntries = useOptimisticEntries(base);
  const { addOrUpdate } = useListActions();
  const byTmdbId = (id) => optimisticEntries.find((e) => e.tmdb_id === id);

  if (results.length === 0) {
    return <p className="muted">No movies found.</p>;
  }

  return (
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
            linkTo={`/movie/${movie.id}`}
            onAddWant={() => addOrUpdate(movie, 'want_to_watch')}
            onAddWatched={() => addOrUpdate(movie, 'watched')}
          />
        );
      })}
    </div>
  );
}
