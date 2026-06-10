/**
 * Tradeflow — Frontend auth token storage.
 *
 * JWT lives in localStorage under `tradeflow.token`. axios attaches it via
 * a request interceptor (see `src/api.js`). The token's `exp` claim is the
 * source of truth for expiry — we just check it client-side to avoid a
 * pointless request when we know it's stale.
 */

const KEY = "tradeflow.token";

export function getToken() {
  try {
    return window.localStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) window.localStorage.setItem(KEY, token);
    else window.localStorage.removeItem(KEY);
  } catch {
    // localStorage can throw in private-mode iframes — silent fallback OK,
    // the user will just be asked to log in again next request.
  }
}

export function clearToken() {
  setToken(null);
}

/** Decode `payload.exp` (unix seconds) without verifying signature. */
export function tokenExpUnix(token) {
  if (!token) return 0;
  const parts = token.split(".");
  if (parts.length !== 3) return 0;
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json);
    return Number(payload?.exp) || 0;
  } catch {
    return 0;
  }
}

export function isTokenExpired(token) {
  const exp = tokenExpUnix(token);
  if (!exp) return true;
  // 30s clock-skew buffer.
  return Date.now() / 1000 >= exp - 30;
}
