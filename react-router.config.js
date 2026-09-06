import { vercelPreset } from '@vercel/react-router/vite';

/** @type {import('@react-router/dev/config').Config} */
export default {
  // Server-side render: loaders/actions run on the server so auth reads the
  // httpOnly session cookie and lists load without a client fetch.
  ssr: true,
  presets: [vercelPreset()],
};
