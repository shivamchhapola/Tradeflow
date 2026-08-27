import { useEffect, useMemo, useRef } from "react";
import {
  X,
  CheckCheck,
  Trash2,
  Target,
  OctagonX,
  ArrowUpRight,
  Clock,
  AlertTriangle,
  Info,
  Award,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useNotifications } from "../../context/NotificationContext";

export default function NotificationDrawer() {
  const {
    notifications,
    unreadCount,
    hasMore,
    loading,
    loadingMore,
    activeFilter,
    setActiveFilter,
    fetchNextPage,
    markAsRead,
    clearRead,
    isDrawerOpen,
    setIsDrawerOpen,
    setSelectedError,
  } = useNotifications();

  const drawerRef = useRef(null);
  const observerTarget = useRef(null);

  // Reset filter to "all" when opening the drawer
  useEffect(() => {
    if (isDrawerOpen) {
      setActiveFilter("all");
    }
  }, [isDrawerOpen, setActiveFilter]);

  // Close drawer on Outside click or Escape key
  useEffect(() => {
    if (!isDrawerOpen) return undefined;
    const onPointerDown = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) {
        // Check if the click target was the bell icon button itself
        const bellBtn = document.getElementById("notification-bell-btn");
        if (bellBtn && bellBtn.contains(e.target)) return;
        setIsDrawerOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setIsDrawerOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isDrawerOpen, setIsDrawerOpen]);

  // IntersectionObserver for Infinite Scrolling
  useEffect(() => {
    if (!isDrawerOpen || !hasMore || loadingMore) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          fetchNextPage();
        }
      },
      { threshold: 0.2 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [isDrawerOpen, hasMore, loadingMore, fetchNextPage]);

  const filteredNotifications = useMemo(() => {
    if (activeFilter === "unread") {
      return notifications.filter((n) => !n.is_read);
    }
    if (activeFilter === "trades") {
      return notifications.filter((n) =>
        ["trade_executed", "stop_hit", "target_hit", "manual_close", "auto_squareoff"].includes(n.type)
      );
    }
    if (activeFilter === "errors") {
      return notifications.filter((n) => ["system_error", "error"].includes(n.type));
    }
    return notifications;
  }, [notifications, activeFilter]);

  const emptyMessages = {
    all: "No notifications recorded yet.",
    unread: "All caught up! No unread notifications.",
    trades: "No trade notifications recorded yet.",
    errors: "All good! No system errors reported.",
  };
  const emptyText = emptyMessages[activeFilter] || "No notifications found";

  if (!isDrawerOpen) return null;

  return (
    <div
      ref={drawerRef}
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        width: 380,
        maxWidth: "92vw",
        maxHeight: "80vh",
        background: "var(--bg-card, #121215)",
        border: "1px solid var(--border-strong, #2a2a30)",
        borderRadius: 12,
        boxShadow: "0 16px 36px rgba(0,0,0,0.5)",
        zIndex: 300,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
      role="dialog"
      aria-label="Notification Center"
    >
      {/* Drawer Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border, #222226)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--bg-elevated, #16161a)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary, #fff)" }}>
            Notifications
          </h4>
          {unreadCount > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: 10,
                background: "var(--red, #ef4444)",
                color: "#fff",
                lineHeight: 1,
              }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {unreadCount > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => markAsRead({ mark_all: true })}
              title="Mark all as read"
              style={{ padding: "4px 8px", fontSize: 11, gap: 4, color: "var(--text-secondary, #aaa)" }}
            >
              <CheckCheck size={14} />
              Read all
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={clearRead}
            title="Clear read notifications"
            style={{ padding: 6, color: "var(--text-muted, #777)" }}
          >
            <Trash2 size={14} />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setIsDrawerOpen(false)}
            style={{ padding: 6, color: "var(--text-muted, #777)" }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border, #222226)",
          background: "rgba(0,0,0,0.2)",
          padding: "4px 8px",
          gap: 4,
        }}
      >
        <FilterTab label="All" active={activeFilter === "all"} onClick={() => setActiveFilter("all")} />
        <FilterTab
          label={`Unread ${unreadCount > 0 ? `(${unreadCount})` : ""}`}
          active={activeFilter === "unread"}
          onClick={() => setActiveFilter("unread")}
        />
        <FilterTab label="Trades" active={activeFilter === "trades"} onClick={() => setActiveFilter("trades")} />
        <FilterTab label="Errors" active={activeFilter === "errors"} onClick={() => setActiveFilter("errors")} />
      </div>

      {/* Notification List Container */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          minHeight: 200,
        }}
      >
        {loading && notifications.length === 0 ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 36, color: "var(--text-muted, #888)" }}>
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div style={{ textAlign: "center", padding: "36px 16px", color: "var(--text-muted, #777)", fontSize: 13 }}>
            {emptyText}
          </div>
        ) : (
          filteredNotifications.map((item) => (
            <NotificationCard
              key={item.id}
              item={item}
              onMarkRead={() => markAsRead(item.id)}
              onOpenDetails={() => setSelectedError(item)}
            />
          ))
        )}

        {/* Sentinel for infinite scroll */}
        <div ref={observerTarget} style={{ height: 20, margin: "4px 0" }}>
          {loadingMore && (
            <div style={{ display: "flex", justifyContent: "center", padding: 8, color: "var(--text-muted, #888)" }}>
              <Loader2 size={16} className="animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterTab({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: "6px 8px",
        borderRadius: 6,
        border: "none",
        background: active ? "var(--bg-elevated, #22222a)" : "transparent",
        color: active ? "var(--text-primary, #fff)" : "var(--text-muted, #888)",
        fontSize: 11,
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
    >
      {label}
    </button>
  );
}

function NotificationCard({ item, onMarkRead, onOpenDetails }) {
  const isError = item.type === "system_error" || item.type === "error";
  const hasDetails = Boolean(item.details);
  
  const iconConfig = getNotificationIcon(item.type);

  const relativeTime = formatRelativeTime(item.created_at);

  return (
    <div
      onClick={onMarkRead}
      style={{
        padding: "12px 14px",
        borderBottom: "1px solid var(--border, #1f1f24)",
        background: item.is_read ? "transparent" : "rgba(255,255,255,0.02)",
        display: "flex",
        gap: 12,
        cursor: "pointer",
        position: "relative",
        transition: "background 0.15s ease",
      }}
      className="notification-item"
    >
      {/* Icon Badge */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: iconConfig.bg,
          color: iconConfig.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {iconConfig.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: item.is_read ? 500 : 600,
              color: "var(--text-primary, #fff)",
              truncate: "ellipsis",
            }}
          >
            {item.title}
          </span>
          <span style={{ fontSize: 10, color: "var(--text-muted, #777)", flexShrink: 0, marginLeft: 6 }}>
            {relativeTime}
          </span>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: 11,
            color: "var(--text-secondary, #aaa)",
            lineHeight: 1.45,
            wordBreak: "break-word",
          }}
        >
          {item.message}
        </p>

        {hasDetails && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetails();
            }}
            style={{
              marginTop: 6,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 10,
              fontWeight: 600,
              color: isError ? "var(--red, #ef4444)" : "var(--accent-light, #60a5fa)",
              background: isError ? "rgba(239, 68, 68, 0.1)" : "rgba(59, 130, 246, 0.1)",
              border: isError ? "1px solid rgba(239, 68, 68, 0.2)" : "1px solid rgba(59, 130, 246, 0.2)",
              borderRadius: 4,
              padding: "2px 6px",
              cursor: "pointer",
            }}
          >
            {isError ? <AlertTriangle size={10} /> : <ExternalLink size={10} />}
            {isError ? "View Error Details" : "View Details"}
          </button>
        )}
      </div>

      {/* Unread blue dot */}
      {!item.is_read && (
        <span
          style={{
            position: "absolute",
            top: 14,
            right: 10,
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--blue, #3b82f6)",
          }}
        />
      )}
    </div>
  );
}

function getNotificationIcon(type) {
  switch (type) {
    case "target_hit":
      return {
        icon: <Target size={16} />,
        bg: "rgba(34, 197, 94, 0.15)",
        color: "var(--green, #22c55e)",
      };
    case "stop_hit":
      return {
        icon: <OctagonX size={16} />,
        bg: "rgba(239, 68, 68, 0.15)",
        color: "var(--red, #ef4444)",
      };
    case "trade_executed":
    case "manual_close":
      return {
        icon: <ArrowUpRight size={16} />,
        bg: "rgba(59, 130, 246, 0.15)",
        color: "var(--blue, #3b82f6)",
      };
    case "auto_squareoff":
      return {
        icon: <Clock size={16} />,
        bg: "rgba(245, 158, 11, 0.15)",
        color: "var(--amber, #f59e0b)",
      };
    case "system_error":
    case "error":
      return {
        icon: <AlertTriangle size={16} />,
        bg: "rgba(239, 68, 68, 0.15)",
        color: "var(--red, #ef4444)",
      };
    case "achievement_unlocked":
    case "quest_completed":
      return {
        icon: <Award size={16} />,
        bg: "rgba(168, 85, 247, 0.15)",
        color: "var(--purple, #a855f7)",
      };
    default:
      return {
        icon: <Info size={16} />,
        bg: "rgba(255, 255, 255, 0.08)",
        color: "var(--text-secondary, #ccc)",
      };
  }
}

function formatRelativeTime(isoStr) {
  if (!isoStr) return "";
  try {
    const date = new Date(isoStr);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 172800) return "Yesterday";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}
