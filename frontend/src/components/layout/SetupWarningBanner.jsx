import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSetupStatus } from "../SetupGuard";

export default function SetupWarningBanner() {
  const { user } = useAuth();
  const { isConfigured } = useSetupStatus();
  const location = useLocation();
  const navigate = useNavigate();

  const isPublicRoute =
    location.pathname === "/login" || location.pathname === "/signup";

  if (!user || isPublicRoute || isConfigured) {
    return null;
  }

  return (
    <div
      className="setup-warning-banner"
      role="alert"
      style={{
        background: "rgba(245, 158, 11, 0.12)",
        borderBottom: "1px solid rgba(245, 158, 11, 0.3)",
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        fontSize: 13,
        color: "var(--text-primary, #fff)",
        zIndex: 100,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <AlertTriangle
          size={16}
          style={{ color: "var(--amber, #f59e0b)", flexShrink: 0 }}
        />
        <span>
          <strong>Initial Setup Required:</strong> Data sources are unconfigured. Configure your base URL to unlock live market data and paper trading.
        </span>
      </div>
      {location.pathname !== "/settings" && (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => navigate("/settings?onboarding=true")}
          style={{
            fontSize: 12,
            whiteSpace: "nowrap",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span>Configure Setup</span>
          <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}
