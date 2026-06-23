// Tiny in-memory TTL cache so a slow/failing upstream API doesn't take the
// dashboard down with it — we fall back to the last good response.
const store = new Map();

async function fetchWithCache(key, ttlMs, fetcher) {
  const cached = store.get(key);
  const now = Date.now();

  if (cached && now - cached.ts < ttlMs) {
    return { data: cached.data, status: 'live', cachedAt: new Date(cached.ts).toISOString() };
  }

  try {
    const data = await fetcher();
    store.set(key, { data, ts: now });
    return { data, status: 'live', cachedAt: new Date(now).toISOString() };
  } catch (err) {
    if (cached) {
      return { data: cached.data, status: 'cached', cachedAt: new Date(cached.ts).toISOString(), error: err.message };
    }
    throw err;
  }
}

module.exports = { fetchWithCache };
