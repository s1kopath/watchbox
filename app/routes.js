import { index, layout, route } from '@react-router/dev/routes';

export default [
  // Public auth routes
  route('login', 'routes/login.jsx'),
  route('register', 'routes/register.jsx'),
  route('logout', 'routes/logout.jsx'),

  // Resource route (action only) for list mutations, driven by fetchers
  route('lists', 'routes/lists.jsx'),

  // Protected app shell — its loader requires a logged-in user; each child
  // page loads its own scoped, paginated data.
  layout('routes/app.jsx', [
    index('routes/search.jsx'),
    route('want-to-watch', 'routes/want-to-watch.jsx'),
    route('watched', 'routes/watched.jsx'),
    route('movie/:id', 'routes/movie.jsx'),
    route('profile', 'routes/profile.jsx'),
  ]),
];
