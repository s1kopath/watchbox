import { Suspense, useEffect, useRef, useState } from 'react';
import { Await, Form, useFetcher, useLoaderData, useNavigation, useSubmit } from 'react-router';
import MovieCard from './MovieCard.jsx';
import { MovieCardSkeleton, MovieListSkeleton } from './Skeleton.jsx';
import { useListActions, useOptimisticEntries } from '../lib/useListActions.js';

const BASE_PATH = { watched: '/watched', want_to_watch: '/want-to-watch' };
const TITLES = { watched: 'Watched', want_to_watch: 'Want to Watch' };

export default function EntryList() {
  const { status, q, sort, page } = useLoaderData();
  const navigation = useNavigation();
  const submit = useSubmit();
  const debounceRef = useRef();

  const basePath = BASE_PATH[status];
  // A query/sort change is a GET navigation to this same route — show the
  // skeleton while it reloads (the page is already mounted, so <Await> alone
  // wouldn't re-suspend).
  const reloading = navigation.state === 'loading' && navigation.location?.pathname === basePath;

  function handleQChange(e) {
    const form = e.currentTarget.form;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => submit(form, { replace: true }), 400);
  }
  function handleSortChange(e) {
    submit(e.currentTarget.form, { replace: true });
  }
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>{TITLES[status]}</h1>
      </header>

      <Form method="get" role="search" className="list-controls">
        <input
          type="search"
          name="q"
          placeholder={`Search your ${TITLES[status].toLowerCase()} list…`}
          defaultValue={q}
          onChange={handleQChange}
          aria-label="Search your list"
          className="list-controls__search"
        />
        <select
          name="sort"
          defaultValue={sort}
          onChange={handleSortChange}
          aria-label="Sort list"
          className="list-controls__sort"
        >
          <option value="added">Recently added</option>
          <option value="rating">Highest rated</option>
          <option value="title">Title A–Z</option>
        </select>
      </Form>

      {reloading ? (
        <MovieListSkeleton />
      ) : (
        <Suspense fallback={<MovieListSkeleton />}>
          <Await resolve={page}>
            {(resolved) => (
              <InfiniteList
                initialPage={resolved}
                status={status}
                q={q}
                sort={sort}
                basePath={basePath}
              />
            )}
          </Await>
        </Suspense>
      )}
    </div>
  );
}

function InfiniteList({ initialPage, status, q, sort, basePath }) {
  const { addOrUpdate, rate, remove } = useListActions();
  const fetcher = useFetcher();
  const [extra, setExtra] = useState([]);
  const [cursor, setCursor] = useState(initialPage.nextCursor);
  const [seenPage, setSeenPage] = useState(initialPage);
  const sentinelRef = useRef(null);

  // Reset accumulation whenever the first page changes — a fresh navigation, a
  // search/sort change, or a post-mutation revalidation — so we never render
  // stale deep pages. Done during render (React's documented reset-on-prop-
  // change pattern) rather than in an effect.
  if (seenPage !== initialPage) {
    setSeenPage(initialPage);
    setExtra([]);
    setCursor(initialPage.nextCursor);
  }

  // Append whatever "load more" fetched (the loader streams it, so the value
  // may be a promise).
  useEffect(() => {
    const p = fetcher.data?.page;
    if (!p) return;
    let cancelled = false;
    Promise.resolve(p).then((pg) => {
      if (cancelled || !pg) return;
      setExtra((prev) => [...prev, ...pg.items]);
      setCursor(pg.nextCursor);
    });
    return () => {
      cancelled = true;
    };
  }, [fetcher.data]);

  // Infinite scroll: fetch the next page as the sentinel nears the viewport.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !cursor) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && fetcher.state === 'idle') {
          const params = new URLSearchParams();
          if (q) params.set('q', q);
          if (sort && sort !== 'added') params.set('sort', sort);
          params.set('cursor', cursor);
          fetcher.load(`${basePath}?${params}`);
        }
      },
      { rootMargin: '400px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, q, sort, basePath, fetcher]);

  const merged = dedupById([...initialPage.items, ...extra]);
  const list = useOptimisticEntries(merged).filter((e) => e.status === status);

  const toMovie = (entry) => ({
    id: entry.tmdb_id,
    title: entry.title,
    poster_path: entry.poster_path,
    release_date: entry.release_date,
    overview: entry.overview,
    vote_average: entry.vote_average,
  });

  if (list.length === 0) {
    return (
      <p className="muted">
        {q
          ? `No matches for “${q}”.`
          : status === 'watched'
            ? "You haven't marked anything as watched yet."
            : 'Your want-to-watch list is empty. Go search for movies!'}
      </p>
    );
  }

  return (
    <>
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
      </div>
      {cursor && (
        <div ref={sentinelRef} className="load-more">
          {fetcher.state !== 'idle' && <MovieCardSkeleton />}
        </div>
      )}
    </>
  );
}

function dedupById(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}
