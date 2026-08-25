import { createContext, useContext, useState, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, Loader2, RotateCcw, Save } from "lucide-react";

const UnsavedChangesContext = createContext({
  isDirty: false,
  setIsDirty: () => {},
  registerSaveHandler: () => {},
  registerDiscardHandler: () => {},
  confirmNavigation: () => true,
});

export function UnsavedChangesProvider({ children }) {
  const [isDirty, setIsDirty] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [pendingPath, setPendingPath] = useState(null);
  const [saving, setSaving] = useState(false);

  const saveHandlerRef = useRef(null);
  const discardHandlerRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();

  const registerSaveHandler = useCallback((fn) => {
    saveHandlerRef.current = fn;
  }, []);

  const registerDiscardHandler = useCallback((fn) => {
    discardHandlerRef.current = fn;
  }, []);

  const confirmNavigation = useCallback(
    (targetPath) => {
      if (!isDirty || targetPath === location.pathname) {
        return true;
      }
      setPendingPath(targetPath);
      setShowModal(true);
      return false;
    },
    [isDirty, location.pathname]
  );

  const handleSaveAndContinue = async () => {
    if (saveHandlerRef.current) {
      setSaving(true);
      try {
        const ok = await saveHandlerRef.current();
        if (ok !== false) {
          setIsDirty(false);
          setShowModal(false);
          if (pendingPath) {
            const target = pendingPath;
            setPendingPath(null);
            navigate(target);
          }
        }
      } catch (err) {
        console.error("Save on navigate error:", err);
      } finally {
        setSaving(false);
      }
    } else {
      setIsDirty(false);
      setShowModal(false);
      if (pendingPath) {
        const target = pendingPath;
        setPendingPath(null);
        navigate(target);
      }
    }
  };

  const handleDiscardAndContinue = () => {
    if (discardHandlerRef.current) {
      discardHandlerRef.current();
    }
    setIsDirty(false);
    setShowModal(false);
    if (pendingPath) {
      const target = pendingPath;
      setPendingPath(null);
      navigate(target);
    }
  };

  const handleStay = () => {
    setShowModal(false);
    setPendingPath(null);
  };

  return (
    <UnsavedChangesContext.Provider
      value={{
        isDirty,
        setIsDirty,
        registerSaveHandler,
        registerDiscardHandler,
        confirmNavigation,
      }}
    >
      {children}
      {showModal && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Unsaved changes warning"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            className="modal-content unsaved-modal"
            style={{
              background: "var(--bg-card, #18181b)",
              border: "1px solid var(--border-strong, #3f3f46)",
              borderRadius: "var(--radius, 12px)",
              padding: "24px",
              maxWidth: "460px",
              width: "100%",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                color: "var(--amber, #f59e0b)",
                marginBottom: 12,
              }}
            >
              <AlertCircle size={22} />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-primary, #fff)" }}>
                Unsaved Changes in Settings
              </h3>
            </div>
            <p
              style={{
                fontSize: 13,
                color: "var(--text-secondary, #aaa)",
                lineHeight: 1.5,
                margin: "0 0 20px 0",
              }}
            >
              You have modified your settings without saving. What would you like to do before leaving this page?
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleStay}
                disabled={saving}
              >
                Stay on page
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleDiscardAndContinue}
                disabled={saving}
              >
                <RotateCcw size={13} style={{ marginRight: 4 }} />
                Discard & Leave
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSaveAndContinue}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 size={13} className="spin" style={{ marginRight: 4 }} /> Saving…
                  </>
                ) : (
                  <>
                    <Save size={13} style={{ marginRight: 4 }} /> Save & Continue
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  return useContext(UnsavedChangesContext);
}
