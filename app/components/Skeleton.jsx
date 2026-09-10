// Reusable loading placeholders. `.skeleton` carries the shimmer; the layout
// classes mirror the real components so the swap to loaded content doesn't jump.

export function MovieCardSkeleton() {
  return (
    <div className="movie-card" aria-hidden="true">
      <div className="movie-card__poster skeleton" />
      <div className="movie-card__body">
        <div className="skeleton skeleton-line skeleton-line--title" />
        <div className="skeleton skeleton-line skeleton-line--sm" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line skeleton-line--short" />
        <div className="skeleton-actions">
          <div className="skeleton skeleton-chip" />
          <div className="skeleton skeleton-chip" />
        </div>
      </div>
    </div>
  );
}

export function MovieListSkeleton({ count = 6 }) {
  return (
    <div className="movie-list" aria-hidden="true" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <MovieCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function MovieDetailsSkeleton() {
  return (
    <div aria-hidden="true" aria-busy="true">
      <div className="skeleton trailer" />
      <div className="details-head">
        <div className="skeleton details-poster" />
        <div className="details-headline">
          <div className="skeleton skeleton-line skeleton-line--title" />
          <div className="skeleton skeleton-line skeleton-line--sm" />
          <div className="skeleton skeleton-line skeleton-line--short" />
        </div>
      </div>
      <div className="skeleton-actions">
        <div className="skeleton skeleton-chip" />
        <div className="skeleton skeleton-chip" />
      </div>
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line skeleton-line--short" />
    </div>
  );
}

export function ProfileStatsSkeleton() {
  return (
    <div className="profile-stats" aria-hidden="true" aria-busy="true">
      <div className="profile-stat">
        <div className="skeleton skeleton-stat" />
      </div>
      <div className="profile-stat">
        <div className="skeleton skeleton-stat" />
      </div>
    </div>
  );
}
