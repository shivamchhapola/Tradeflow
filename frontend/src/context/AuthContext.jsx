/**
 * Tradeflow — Auth context.
 *
 * Source of truth for the logged-in user + their cached stats. Mounted at the
 * top of the tree in main.jsx. Components consume via `useAuth()`.
 *
 * Boot flow:
 *   1. If no token in localStorage → state.user = null, loading = false.
 *   2. If token present → fetch /api/auth/me. On 200, hydrate user+stats.
 *      On 401 (token expired / user deleted), clear token and bounce.
 *
 * Listens for the `tradeflow:auth-expired` event fired by the api.js 401
 * interceptor — this triggers a clean logout from anywhere in the app.
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getMe, login as loginApi, signup as signupApi } from "../api";
import { invalidateStats } from "../hooks/useStats";
import { clearToken, getToken, isTokenExpired, setToken } from "../lib/auth";
import { toast } from "sonner";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [prevBadges, setPrevBadges] = useState(null);

  useEffect(() => {
    if (stats?.achievements) {
      if (prevBadges !== null) {
        const newBadges = stats.achievements.filter(badge => !prevBadges.includes(badge));
        newBadges.forEach(() => {
           toast.success("Achievement Unlocked! Check your portfolio.");
        });
      }
      setPrevBadges(stats.achievements);
    } else {
      setPrevBadges(null);
    }
  }, [stats?.achievements]);

  const logout = useCallback(() => {
    clearToken();
    invalidateStats();
    setUser(null);
    setStats(null);
  }, []);

  const hydrate = useCallback(async () => {
    const token = getToken();
    if (!token || isTokenExpired(token)) {
      clearToken();
      setUser(null);
      setStats(null);
      setLoading(false);
      return;
    }
    try {
      const data = await getMe();
      setUser(data.user || null);
      if (data.stats) {
        data.stats.achievements = data.achievements || [];
      }
      setStats(data.stats || null);
    } catch {
      // 401 / network error — fall back to logged-out state.
      clearToken();
      setUser(null);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    function onExpired() {
      invalidateStats();
      setUser(null);
      setStats(null);
    }
    window.addEventListener("tradeflow:auth-expired", onExpired);
    return () => window.removeEventListener("tradeflow:auth-expired", onExpired);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await loginApi({ email, password });
    setToken(data.token);
    invalidateStats();
    setUser(data.user);
    // /me also returns stats — fetch once after login so the navbar populates.
    try {
      const me = await getMe();
      if (me.stats) {
        me.stats.achievements = me.achievements || [];
      }
      setStats(me.stats || null);
    } catch {
      setStats(null);
    }
    return data.user;
  }, []);

  const signup = useCallback(async (email, password, display_name) => {
    const data = await signupApi({ email, password, display_name });
    setToken(data.token);
    invalidateStats();
    setUser(data.user);
    setStats({
      total_xp: 0,
      streak_days: 0,
      last_active: null,
      virtual_balance: 500000,
      achievements: [],
    });
    return data.user;
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const me = await getMe();
      if (me.stats) {
        me.stats.achievements = me.achievements || [];
      }
      setStats(me.stats || null);
      return me.stats;
    } catch {
      return null;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, stats, loading, login, signup, logout, refreshStats }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
