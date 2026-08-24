import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { getNotifications, markNotificationsRead, createNotification, clearReadNotifications } from "../api";
import { useAuth } from "./AuthContext";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all"); // "all", "unread", "trades", "errors"
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedError, setSelectedError] = useState(null);
  
  const prevFilterRef = useRef(activeFilter);

  const fetchInitial = useCallback(async (filter = activeFilter) => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setHasMore(false);
      setNextCursor(null);
      return;
    }
    setLoading(true);
    try {
      const typeCat = filter === "trades" ? "trades" : filter === "errors" ? "errors" : null;
      const unreadOnly = filter === "unread";
      const res = await getNotifications({ limit: 20, unread_only: unreadOnly, type_category: typeCat });
      setNotifications(res.items || []);
      setUnreadCount(res.unread_count || 0);
      setHasMore(res.has_more || false);
      setNextCursor(res.next_cursor || null);
    } catch (e) {
      console.error("Failed to fetch notifications:", e);
    } finally {
      setLoading(false);
    }
  }, [user, activeFilter]);

  const fetchNextPage = useCallback(async () => {
    if (!user || !hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const typeCat = activeFilter === "trades" ? "trades" : activeFilter === "errors" ? "errors" : null;
      const unreadOnly = activeFilter === "unread";
      const res = await getNotifications({
        limit: 20,
        before_id: nextCursor,
        unread_only: unreadOnly,
        type_category: typeCat,
      });
      setNotifications((prev) => [...prev, ...(res.items || [])]);
      setUnreadCount(res.unread_count || 0);
      setHasMore(res.has_more || false);
      setNextCursor(res.next_cursor || null);
    } catch (e) {
      console.error("Failed to fetch next page notifications:", e);
    } finally {
      setLoadingMore(false);
    }
  }, [user, hasMore, nextCursor, loadingMore, activeFilter]);

  const refreshUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await getNotifications({ limit: 1 });
      setUnreadCount(res.unread_count || 0);
    } catch {
      // Ignore background refresh errors
    }
  }, [user]);

  // Polling unread count every 15s when user is logged in
  useEffect(() => {
    if (!user) return undefined;
    fetchInitial(activeFilter);
    const interval = setInterval(() => {
      refreshUnreadCount();
    }, 15000);
    return () => clearInterval(interval);
  }, [user, activeFilter, fetchInitial, refreshUnreadCount]);

  const handleFilterChange = (newFilter) => {
    setActiveFilter(newFilter);
  };

  const markAsRead = useCallback(async (idsOrAll = { mark_all: true }) => {
    try {
      if (typeof idsOrAll === "object" && idsOrAll.mark_all) {
        await markNotificationsRead({ mark_all: true });
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
      } else if (Array.isArray(idsOrAll)) {
        await markNotificationsRead({ ids: idsOrAll });
        setNotifications((prev) =>
          prev.map((n) => (idsOrAll.includes(n.id) ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - idsOrAll.length));
      } else if (typeof idsOrAll === "number") {
        await markNotificationsRead({ ids: [idsOrAll] });
        setNotifications((prev) =>
          prev.map((n) => (n.id === idsOrAll ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (e) {
      console.error("Failed to mark notifications read:", e);
    }
  }, []);

  const clearRead = useCallback(async () => {
    try {
      await clearReadNotifications();
      setNotifications((prev) => prev.filter((n) => !n.is_read));
    } catch (e) {
      console.error("Failed to clear read notifications:", e);
    }
  }, []);

  const notify = useCallback(async ({ type = "info", title, message, details = null }) => {
    if (!user) return;
    try {
      const created = await createNotification({ type, title, message, details });
      setNotifications((prev) => [created, ...prev]);
      setUnreadCount((prev) => prev + 1);
    } catch (e) {
      console.error("Failed to post notification:", e);
    }
  }, [user]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        hasMore,
        loading,
        loadingMore,
        activeFilter,
        setActiveFilter: handleFilterChange,
        fetchNextPage,
        markAsRead,
        clearRead,
        notify,
        isDrawerOpen,
        setIsDrawerOpen,
        selectedError,
        setSelectedError,
        refresh: () => fetchInitial(activeFilter),
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within <NotificationProvider>");
  return ctx;
}
