import { useEffect } from 'react';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
} from 'react-router';
import Icon from './components/Icon.jsx';
import stylesHref from './index.css?url';

export const links = () => [{ rel: 'stylesheet', href: stylesHref }];

export const meta = () => [
  { title: 'MovieBox' },
  { name: 'description', content: 'Track what you have watched and want to watch' },
  { name: 'theme-color', content: '#0f1115' },
  { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
];

export function Layout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <Meta />
        <Links />
      </head>
      <body>
        <div id="root">{children}</div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Something went wrong';

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <Icon name="film" size={40} />
        </div>
        <h1>MovieBox</h1>
        <p className="auth-error">{message}</p>
      </div>
    </div>
  );
}
