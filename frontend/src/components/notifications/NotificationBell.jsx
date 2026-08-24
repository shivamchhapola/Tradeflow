import { Bell } from "lucide-react";
import { useNotifications } from "../../context/NotificationContext";
import NotificationDrawer from "./NotificationDrawer";

export default function NotificationBell() {
  const { unreadCount, isDrawerOpen, setIsDrawerOpen } = useNotifications();

  return (
    <div style={{ position: "relative" }}>
      <button
        id="notification-bell-btn"
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setIsDrawerOpen(!isDrawerOpen)}
        style={{
          padding: "6px 8px",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: isDrawerOpen ? "var(--text-primary, #fff)" : "var(--text-secondary, #aaa)",
        }}
        aria-haspopup="dialog"
        aria-expanded={isDrawerOpen}
        aria-label={`Notifications (${unreadCount} unread)`}
      >
        <Bell size={15} />

        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              minWidth: 14,
              height: 14,
              borderRadius: 7,
              background: "var(--red, #ef4444)",
              color: "#ffffff",
              fontSize: 9,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
              lineHeight: 1,
              boxShadow: "0 0 6px rgba(239, 68, 68, 0.6)",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Floating Instagram-style Drawer */}
      <NotificationDrawer />
    </div>
  );
}
