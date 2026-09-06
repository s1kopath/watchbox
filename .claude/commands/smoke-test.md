---
description: Verify the app end-to-end — offline server test + live cookie-auth flow against the dev server.
allowed-tools: Bash, Read
---

Verify MovieBox is working, in two layers. Report a concise pass/fail summary.

## 1. Offline server smoke test (fast, always run this)

```bash
npm test        # scripts/smoke-test.mjs — list CRUD + session cookie, temp SQLite, no network
npm run lint
```

## 2. Live end-to-end flow (only if the change affects routes/auth/UI)

Start the dev server if it isn't already running (`npm run dev`, serves
http://localhost:5173), then drive the real flow with a cookie jar. Use a
unique throwaway email so it doesn't collide:

```bash
J=/tmp/moviebox-smoke-cookies.txt
BASE=http://localhost:5173
EMAIL="smoke_$(date +%s)@example.com"

# logged-out root should redirect to /login
curl -s -o /dev/null -w "guard: %{http_code} -> %{redirect_url}\n" $BASE/

# register -> expect 302 + httpOnly Set-Cookie
curl -s -i -c $J -X POST $BASE/register \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "email=$EMAIL" --data-urlencode "password=secret123" \
  | grep -iE "^HTTP/|^set-cookie:"

# protected page + TMDB trending, then search
curl -s -b $J $BASE/ | grep -oE 'Search Movies|Trending this week' | head -1
curl -s -b $J "$BASE/?q=inception" | grep -oE 'Inception' | head -1

# add to watched, then confirm it renders on /watched
curl -s -b $J -o /dev/null -w "add: %{http_code}\n" -X POST $BASE/lists \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "intent=add" --data-urlencode "tmdb_id=27205" \
  --data-urlencode "title=Inception" --data-urlencode "status=watched"
curl -s -b $J $BASE/watched | grep -oE 'Inception' | head -1

# logout clears the cookie and re-locks routes
curl -s -i -b $J -c $J -X POST $BASE/logout | grep -iE "^HTTP/|^set-cookie:"
curl -s -o /dev/null -w "after logout: %{http_code}\n" -b $J $BASE/
```

**Cleanup:** the live flow creates a real user in Turso. Delete it afterward:

```bash
node -e "import('dotenv/config').then(async()=>{const{createClient}=await import('@libsql/client');const db=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});const r=await db.execute(\"DELETE FROM users WHERE email LIKE 'smoke_%@example.com'\");console.log('cleaned smoke users:',r.rowsAffected);})"
```

Do NOT deploy or push as part of verification.
