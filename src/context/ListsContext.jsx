import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const ListsContext = createContext(null);

export function ListsProvider({ children }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setEntries([]);
      return;
    }
    setLoading(true);
    try {
      const data = await api.getEntries();
      setEntries(data.entries || []);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const byTmdbId = useCallback(
    (tmdbId) => entries.find((e) => e.tmdb_id === tmdbId),
    [entries]
  );

  const addOrUpdate = useCallback(
    async (movie, status) => {
      const existing = byTmdbId(movie.id);
      if (existing) {
        await api.updateEntry(existing.id, { status });
      } else {
        await api.addEntry({
          tmdb_id: movie.id,
          title: movie.title,
          poster_path: movie.poster_path,
          release_date: movie.release_date,
          overview: movie.overview,
          vote_average: movie.vote_average,
          status,
        });
      }
      await refresh();
    },
    [byTmdbId, refresh]
  );

  const rate = useCallback(
    async (entryId, rating) => {
      await api.updateEntry(entryId, { rating });
      await refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (entryId) => {
      await api.deleteEntry(entryId);
      await refresh();
    },
    [refresh]
  );

  const watched = entries.filter((e) => e.status === 'watched');
  const wantToWatch = entries.filter((e) => e.status === 'want_to_watch');

  return (
    <ListsContext.Provider
      value={{ entries, watched, wantToWatch, loading, byTmdbId, addOrUpdate, rate, remove, refresh }}
    >
      {children}
    </ListsContext.Provider>
  );
}

export function useLists() {
  const ctx = useContext(ListsContext);
  if (!ctx) throw new Error('useLists must be used within ListsProvider');
  return ctx;
}
