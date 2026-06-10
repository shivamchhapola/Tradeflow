/**
 * Tradeflow — App-auth gate.
 */

import { useLocation, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LOADING } from "../lib/copy";

const PUBLIC_PATHS = new Set(["/login", "/signup"]);

export default function AuthWrapper({ children }) {
  const location = useLocation();
  const { user, loading } = useAuth();
  const isPublic = PUBLIC_PATHS.has(location.pathname);

  if (loading) {
    return <AuthSkeleton message={LOADING.auth} />;
  }

  if (!user && !isPublic) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return children;
}

function AuthSkeleton({ message }) {
  return (
    <div className="main" aria-busy="true" aria-live="polite">
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "var(--text-secondary)",
            fontSize: 13,
          }}
        >
          <span className="spinner" />
          {message}
        </div>
        <div className="skeleton skeleton-line" style={{ width: "30%", height: 20 }} />
        <div className="skeleton" style={{ height: 160 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16 }}>
          <div className="skeleton" style={{ height: 220 }} />
          <div className="skeleton" style={{ height: 220 }} />
        </div>
      </div>
    </div>
  );
}
