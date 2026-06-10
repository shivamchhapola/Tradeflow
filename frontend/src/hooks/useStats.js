import { useEffect, useState, useCallback } from "react";
import { getStats } from "../api";

/**
 * Tiny shared cache for /api/stats.
 *
 * StreakBar (in the nav) and Portfolio both consume the same payload —
 * without coordination they fire two requests on every page navigation.
 * This hook keeps a module-level cache + 30s TTL + in-flight dedup +
 * a subscriber set so all consumers re-render together when data lands.
 */

const TTL_MS = 30_000;

let cache = { data: null, ts: 0 };
let inflight = null;
const subs = new Set();

function notify() {
  subs.forEach((cb) => cb(cache.data));
}

async function fetchStats(force = false) {
  const fresh = cache.data && Date.now() - cache.ts < TTL_MS;
  if (fresh && !force) return cache.data;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const data = await getStats();
      cache = { data, ts: Date.now() };
      notify();
      return data;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export default function useStats() {
  const [stats, setStats] = useState(cache.data);
  const [error, setError] = useState(null);

  useEffect(() => {
    const cb = (data) => setStats(data);
    subs.add(cb);

    fetchStats().catch((err) => setError(err));

    return () => {
      subs.delete(cb);
    };
  }, []);

  const refresh = useCallback(() => {
    setError(null);
    return fetchStats(true).catch((err) => {
      setError(err);
      throw err;
    });
  }, []);

  return { stats, error, refresh };
}

/** Manual cache invalidation — call after a mutation (e.g. closing a trade). */
export function invalidateStats() {
  cache = { data: null, ts: 0 };
}
