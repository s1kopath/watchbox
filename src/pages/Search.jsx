import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client.js';
import { useLists } from '../context/ListsContext.jsx';
import MovieCard from '../components/MovieCard.jsx';

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [heading, setHeading] = useState('Trending this week');
  const debounceRef = useRef();
  const { byTmdbId, addOrUpdate } = useLists();

  const loadTrending = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.trendingMovies();
      setResults(data.results || []);
      setHeading('Trending this week');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrending();
  }, [loadTrending]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) {
      loadTrending();
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const data = await api.searchMovies(query.trim());
        setResults(data.results || []);
        setHeading(`Results for "${query.trim()}"`);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query, loadTrending]);

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>Search Movies</h1>
      </header>

      <div className="search-bar">
        <input
          type="search"
          placeholder="Search for a movie…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <h2 className="section-label">{heading}</h2>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="auth-error">{error}</p>}

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
        {!loading && results.length === 0 && <p className="muted">No movies found.</p>}
      </div>
    </div>
  );
}
