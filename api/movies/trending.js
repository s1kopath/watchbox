const TMDB_BASE = 'https://api.themoviedb.org/3';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'TMDB_API_KEY is not configured' });
  }

  try {
    const url = `${TMDB_BASE}/trending/movie/week?api_key=${apiKey}`;
    const r = await fetch(url);
    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json(data);
    }
    return res.status(200).json(data);
  } catch (err) {
    console.error('tmdb trending error', err);
    return res.status(502).json({ error: 'Failed to reach TMDB' });
  }
}
