const TMDB_BASE = 'https://api.themoviedb.org/3';

function apiKey() {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Response('TMDB_API_KEY is not configured', { status: 500 });
  return key;
}

async function tmdb(url) {
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Response('Failed to reach TMDB', { status: 502 });
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Response(data?.status_message || 'TMDB request failed', { status: res.status });
  }
  return data;
}

export async function searchMovies(query, page = 1) {
  const url = `${TMDB_BASE}/search/movie?api_key=${apiKey()}&query=${encodeURIComponent(
    query
  )}&page=${encodeURIComponent(page)}&include_adult=false`;
  return tmdb(url);
}

export async function trendingMovies() {
  return tmdb(`${TMDB_BASE}/trending/movie/week?api_key=${apiKey()}`);
}
