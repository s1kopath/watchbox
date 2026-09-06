import { Form, useRouteLoaderData } from 'react-router';

export default function Profile() {
  const { user, entries } = useRouteLoaderData('routes/app');
  const watched = entries.filter((e) => e.status === 'watched');
  const wantToWatch = entries.filter((e) => e.status === 'want_to_watch');

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>Profile</h1>
      </header>

      <div className="profile-card">
        <div className="profile-avatar">{user?.email?.[0]?.toUpperCase() || '?'}</div>
        <p className="profile-email">{user?.email}</p>
      </div>

      <div className="profile-stats">
        <div className="profile-stat">
          <span className="profile-stat__value">{watched.length}</span>
          <span className="profile-stat__label">Watched</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat__value">{wantToWatch.length}</span>
          <span className="profile-stat__label">Want to Watch</span>
        </div>
      </div>

      <Form method="post" action="/logout">
        <button type="submit" className="btn btn--danger">
          Log Out
        </button>
      </Form>
    </div>
  );
}
