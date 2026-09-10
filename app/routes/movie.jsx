import { Suspense, useState } from 'react';
import { Await, useLoaderData, useNavigate } from 'react-router';
import { requireUser } from '../lib/session.server.js';
import { getMovieDetails } from '../lib/tmdb.server.js';
import { getStatusFor } from '../lib/lists.server.js';
import Icon from '../components/Icon.jsx';
import { MovieDetailsSkeleton } from '../components/Skeleton.jsx';
import { useListActions, useOptimisticEntries } from '../lib/useListActions.js';

const IMG = 'https://image.tmdb.org/t/p';

// Prefer an official YouTube Trailer, then Teaser, then anything on YouTube.
function pickTrailer(videos) {
  const yt = (videos?.results || []).filter((v) => v.site === 'YouTube');
  const score = (v) =>
    (v.type === 'Trailer' ? 2 : v.type === 'Teaser' ? 1 : 0) + (v.official ? 0.5 : 0);
  yt.sort((a, b) => score(b) - score(a));
  const best = yt[0];
  return best ? { key: best.key, name: best.name } : null;
}

// Trim TMDB's large payload down to what the page renders (also honours the
// "don't store TMDB data" spirit — this is fetched live, never persisted).
function shapeDetails(d) {
  return {
    tmdb_id: d.id,
    title: d.title,
    tagline: d.tagline || '',
    overview: d.overview || '',
    poster_path: d.poster_path,
    backdrop_path: d.backdrop_path,
    release_date: d.release_date,
    runtime: d.runtime || 0,
    vote_average: d.vote_average,
    genres: (d.genres || []).map((g) => g.name),
    trailer: pickTrailer(d.videos),
    cast: (d.credits?.cast || []).slice(0, 12).map((c) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profile_path: c.profile_path,
    })),
  };
}

export async function loader({ request, params }) {
  const user = await requireUser(request);
  const id = Number(params.id);
  if (!Number.isFinite(id)) throw new Response('Not found', { status: 404 });
  // Stream both so the page renders immediately with a skeleton.
  const details = getMovieDetails(id).then(shapeDetails);
  const status = getStatusFor(user.id, [id]).then((map) => map[id] || null);
  return { details, status };
}

export default function MovieDetail() {
  const { details, status } = useLoaderData();
  const navigate = useNavigate();

  return (
    <div className="screen movie-details">
      <button type="button" className="back-btn" onClick={() => navigate(-1)}>
        <span className="back-btn__chevron" aria-hidden="true">
          ‹
        </span>
        Back
      </button>

      <Suspense fallback={<MovieDetailsSkeleton />}>
        <Await
          resolve={details}
          errorElement={<p className="muted">Couldn’t load this movie. Please try again.</p>}
        >
          {(movie) => (
            <Await resolve={status}>{(entry) => <Details movie={movie} entry={entry} />}</Await>
          )}
        </Await>
      </Suspense>
    </div>
  );
}

function Details({ movie, entry }) {
  const { addOrUpdate, rate, remove } = useListActions();
  // Overlay in-flight mutations so the buttons react instantly.
  const optimistic = useOptimisticEntries(entry ? [entry] : []).find(
    (e) => e.tmdb_id === movie.tmdb_id
  );
  const status = optimistic?.status;
  const rating = optimistic?.rating ?? 0;
  const entryId = entry?.id; // real id (for rate/remove) once persisted

  const year = movie.release_date ? movie.release_date.slice(0, 4) : '';
  const meta = [
    year,
    formatRuntime(movie.runtime),
    movie.genres.slice(0, 3).join(', '),
  ].filter(Boolean);

  const toMovie = () => ({
    id: movie.tmdb_id,
    title: movie.title,
    poster_path: movie.poster_path,
    release_date: movie.release_date,
    overview: movie.overview,
    vote_average: movie.vote_average,
  });

  return (
    <>
      {movie.trailer ? (
        <TrailerFacade trailer={movie.trailer} backdropPath={movie.backdrop_path} />
      ) : movie.backdrop_path ? (
        <div className="details-hero">
          <img src={`${IMG}/w780${movie.backdrop_path}`} alt="" className="details-hero__img" />
        </div>
      ) : null}

      <div className="details-head">
        {movie.poster_path ? (
          <img
            src={`${IMG}/w342${movie.poster_path}`}
            alt={movie.title}
            className="details-poster"
          />
        ) : (
          <div className="details-poster details-poster--empty">
            <Icon name="film" size={32} />
          </div>
        )}

        <div className="details-headline">
          <h1 className="details-title">
            {movie.title} {year && <span className="movie-card__year">({year})</span>}
          </h1>
          {movie.tagline && <p className="details-tagline">{movie.tagline}</p>}
          {meta.length > 0 && <p className="details-meta">{meta.join(' · ')}</p>}
          {typeof movie.vote_average === 'number' && movie.vote_average > 0 && (
            <div className="movie-card__rating">
              <Icon name="star" size={14} filled className="movie-card__rating-star" />
              {movie.vote_average.toFixed(1)}
            </div>
          )}
        </div>
      </div>

      <div className="details-actions">
        <button
          className={`chip ${status === 'want_to_watch' ? 'chip--active' : ''}`}
          onClick={() => addOrUpdate(toMovie(), 'want_to_watch')}
        >
          <Icon name="bookmark" size={15} />
          Want to Watch
        </button>
        <button
          className={`chip ${status === 'watched' ? 'chip--active' : ''}`}
          onClick={() => addOrUpdate(toMovie(), 'watched')}
        >
          <Icon name="check" size={15} />
          Watched
        </button>
        {status && entryId && (
          <button className="chip chip--danger" onClick={() => remove(entryId)}>
            <Icon name="trash" size={15} />
            Remove
          </button>
        )}
      </div>

      {status === 'watched' && entryId && (
        <div className="movie-card__stars details-stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              className={`star ${rating >= n ? 'star--filled' : ''}`}
              onClick={() => rate(entryId, n === rating ? 0 : n)}
              aria-label={`Rate ${n} stars`}
            >
              <Icon name="star" size={22} filled={rating >= n} />
            </button>
          ))}
        </div>
      )}

      {movie.overview && <p className="details-overview">{movie.overview}</p>}

      <CastStrip cast={movie.cast} />
    </>
  );
}

function TrailerFacade({ trailer, backdropPath }) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="trailer trailer--playing">
        <iframe
          className="trailer__frame"
          src={`https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1`}
          title={trailer.name || 'Trailer'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="trailer trailer--facade"
      onClick={() => setPlaying(true)}
      aria-label={`Play trailer${trailer.name ? `: ${trailer.name}` : ''}`}
      style={
        backdropPath ? { backgroundImage: `url(${IMG}/w780${backdropPath})` } : undefined
      }
    >
      <span className="trailer__play">
        <Icon name="play" size={28} filled />
      </span>
      <span className="trailer__label">Play trailer</span>
    </button>
  );
}

function CastStrip({ cast }) {
  if (!cast || cast.length === 0) return null;
  return (
    <section className="cast">
      <h2 className="section-label">Cast</h2>
      <div className="cast__strip">
        {cast.map((c) => (
          <div key={c.id} className="cast__member">
            {c.profile_path ? (
              <img
                src={`${IMG}/w185${c.profile_path}`}
                alt={c.name}
                loading="lazy"
                className="cast__photo"
              />
            ) : (
              <div className="cast__photo cast__photo--empty">
                <Icon name="user" size={22} />
              </div>
            )}
            <span className="cast__name">{c.name}</span>
            {c.character && <span className="cast__character">{c.character}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

function formatRuntime(minutes) {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}
