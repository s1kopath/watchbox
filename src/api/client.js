const TOKEN_KEY = 'movielist_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export const api = {
  register: (email, password) =>
    request('/auth/register', { method: 'POST', body: { email, password }, auth: false }),
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password }, auth: false }),

  searchMovies: (q, page = 1) =>
    request(`/movies/search?q=${encodeURIComponent(q)}&page=${page}`, { auth: false }),
  trendingMovies: () => request('/movies/trending', { auth: false }),

  getEntries: () => request('/lists'),
  addEntry: (entry) => request('/lists', { method: 'POST', body: entry }),
  updateEntry: (id, patch) => request(`/lists/${id}`, { method: 'PATCH', body: patch }),
  deleteEntry: (id) => request(`/lists/${id}`, { method: 'DELETE' }),
};
