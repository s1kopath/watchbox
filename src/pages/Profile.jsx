import { useAuth } from '../context/AuthContext.jsx';
import { useLists } from '../context/ListsContext.jsx';

export default function Profile() {
  const { user, logout } = useAuth();
  const { watched, wantToWatch } = useLists();

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

      <button className="btn btn--danger" onClick={logout}>
        Log Out
      </button>
    </div>
  );
}
