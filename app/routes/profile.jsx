import { Suspense } from 'react';
import { Await, Form, useLoaderData, useRouteLoaderData } from 'react-router';
import { requireUser } from '../lib/session.server.js';
import { getCounts } from '../lib/lists.server.js';
import { ProfileStatsSkeleton } from '../components/Skeleton.jsx';

export async function loader({ request }) {
  const user = await requireUser(request);
  // Counts come from a cheap COUNT(*) GROUP BY, not by loading every row.
  return { counts: getCounts(user.id) };
}

export default function Profile() {
  const { user } = useRouteLoaderData('routes/app');
  const { counts } = useLoaderData();

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>Profile</h1>
      </header>

      <div className="profile-card">
        <div className="profile-avatar">{user?.email?.[0]?.toUpperCase() || '?'}</div>
        <p className="profile-email">{user?.email}</p>
      </div>

      <Suspense fallback={<ProfileStatsSkeleton />}>
        <Await resolve={counts}>{(resolved) => <ProfileStats counts={resolved} />}</Await>
      </Suspense>

      <Form method="post" action="/logout">
        <button type="submit" className="btn btn--danger">
          Log Out
        </button>
      </Form>

      <footer className="attribution">
        <img
          src="/tmdb-logo.svg"
          alt="The Movie Database (TMDB)"
          className="attribution__logo"
          width="130"
          height="17"
        />
        <p className="attribution__text">
          This product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
      </footer>
    </div>
  );
}

function ProfileStats({ counts }) {
  return (
    <div className="profile-stats">
      <div className="profile-stat">
        <span className="profile-stat__value">{counts.watched}</span>
        <span className="profile-stat__label">Watched</span>
      </div>
      <div className="profile-stat">
        <span className="profile-stat__value">{counts.want_to_watch}</span>
        <span className="profile-stat__label">Want to Watch</span>
      </div>
    </div>
  );
}
