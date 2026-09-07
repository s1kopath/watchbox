import Icon from './Icon.jsx';

const POSTER_BASE = 'https://image.tmdb.org/t/p/w342';

export default function MovieCard({
  title,
  posterPath,
  releaseDate,
  overview,
  voteAverage,
  rating,
  status,
  onAddWant,
  onAddWatched,
  onRate,
  onRemove,
}) {
  const year = releaseDate ? releaseDate.slice(0, 4) : '';

  return (
    <div className="movie-card">
      <div className="movie-card__poster">
        {posterPath ? (
          <img src={`${POSTER_BASE}${posterPath}`} alt={title} loading="lazy" />
        ) : (
          <div className="movie-card__poster-placeholder">
            <Icon name="film" size={30} />
          </div>
        )}
      </div>
      <div className="movie-card__body">
        <h3 className="movie-card__title">
          {title} {year && <span className="movie-card__year">({year})</span>}
        </h3>
        {typeof voteAverage === 'number' && voteAverage > 0 && (
          <div className="movie-card__rating">
            <Icon name="star" size={14} filled className="movie-card__rating-star" />
            {voteAverage.toFixed(1)}
          </div>
        )}
        {overview && <p className="movie-card__overview">{overview}</p>}

        <div className="movie-card__actions">
          {onAddWant && (
            <button
              className={`chip ${status === 'want_to_watch' ? 'chip--active' : ''}`}
              onClick={onAddWant}
            >
              <Icon name="bookmark" size={15} />
              Want to Watch
            </button>
          )}
          {onAddWatched && (
            <button
              className={`chip ${status === 'watched' ? 'chip--active' : ''}`}
              onClick={onAddWatched}
            >
              <Icon name="check" size={15} />
              Watched
            </button>
          )}
          {onRemove && (
            <button className="chip chip--danger" onClick={onRemove}>
              <Icon name="trash" size={15} />
              Remove
            </button>
          )}
        </div>

        {onRate && (
          <div className="movie-card__stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                className={`star ${rating >= n ? 'star--filled' : ''}`}
                onClick={() => onRate(n === rating ? 0 : n)}
                aria-label={`Rate ${n} stars`}
              >
                <Icon name="star" size={20} filled={rating >= n} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
