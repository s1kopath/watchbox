import { NavLink } from 'react-router';
import Icon from './Icon.jsx';

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className="bottom-nav__item">
        <Icon name="search" size={22} className="bottom-nav__icon" />
        <span>Search</span>
      </NavLink>
      <NavLink to="/want-to-watch" className="bottom-nav__item">
        <Icon name="bookmark" size={22} className="bottom-nav__icon" />
        <span>Want to Watch</span>
      </NavLink>
      <NavLink to="/watched" className="bottom-nav__item">
        <Icon name="check" size={22} className="bottom-nav__icon" />
        <span>Watched</span>
      </NavLink>
      <NavLink to="/profile" className="bottom-nav__item">
        <Icon name="user" size={22} className="bottom-nav__icon" />
        <span>Profile</span>
      </NavLink>
    </nav>
  );
}
