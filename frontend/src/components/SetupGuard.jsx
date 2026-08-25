import { useEffect, useState, useCallback, useRef, createContext, useContext } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { getSettingsStatus } from "../api";

const SetupContext = createContext({
  checked: false,
  isConfigured: true,
  refreshSetupStatus: () => {},
});

export function useSetupStatus() {
  return useContext(SetupContext);
}

export default function SetupGuard({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);
  const lastToastTimeRef = useRef(0);

  const checkStatus = useCallback(async () => {
    if (!user) {
      setChecked(true);
      return;
    }
    try {
      const status = await getSettingsStatus();
      setIsConfigured(status.is_configured);

      if (
        !status.is_configured &&
        location.pathname !== "/settings" &&
        location.pathname !== "/learn"
      ) {
        const now = Date.now();
        if (now - lastToastTimeRef.current > 5000) {
          toast.error("Initial setup required. Please configure your data sources.", {
            id: "setup-required-toast",
          });
          lastToastTimeRef.current = now;
        }
        navigate("/settings?onboarding=true", { replace: true });
      }
    } catch (err) {
      console.warn("Failed to check configuration status:", err);
      setIsConfigured(false);
    } finally {
      setChecked(true);
    }
  }, [user, location.pathname, navigate]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const isAllowedPath =
    location.pathname === "/settings" ||
    location.pathname === "/login" ||
    location.pathname === "/signup" ||
    location.pathname === "/learn";

  if (!checked && user && !isAllowedPath) {
    return null;
  }

  if (!isConfigured && user && !isAllowedPath) {
    return null;
  }

  return (
    <SetupContext.Provider value={{ checked, isConfigured, refreshSetupStatus: checkStatus }}>
      {children}
    </SetupContext.Provider>
  );
}
