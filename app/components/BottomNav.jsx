import { NavLink } from 'react-router';

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className="bottom-nav__item">
        <span className="bottom-nav__icon">🔍</span>
        <span>Search</span>
      </NavLink>
      <NavLink to="/want-to-watch" className="bottom-nav__item">
        <span className="bottom-nav__icon">🔖</span>
        <span>Want to Watch</span>
      </NavLink>
      <NavLink to="/watched" className="bottom-nav__item">
        <span className="bottom-nav__icon">✅</span>
        <span>Watched</span>
      </NavLink>
      <NavLink to="/profile" className="bottom-nav__item">
        <span className="bottom-nav__icon">👤</span>
        <span>Profile</span>
      </NavLink>
    </nav>
  );
}
