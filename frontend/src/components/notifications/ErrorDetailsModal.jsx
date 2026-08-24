import { useState } from "react";
import { AlertTriangle, X, Copy, Check, Terminal } from "lucide-react";
import { useNotifications } from "../../context/NotificationContext";

export default function ErrorDetailsModal() {
  const { selectedError, setSelectedError } = useNotifications();
  const [copied, setCopied] = useState(false);

  if (!selectedError) return null;

  const handleCopy = () => {
    const textToCopy = `Title: ${selectedError.title}\nTime: ${selectedError.created_at}\nMessage: ${selectedError.message}\n\nDetails:\n${selectedError.details || "No additional details provided."}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedDate = new Date(selectedError.created_at).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={() => setSelectedError(null)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="error-modal-title"
    >
      <div
        style={{
          width: "100%",
          maxWidth: 600,
          background: "var(--bg-card, #121215)",
          border: "1px solid var(--border-strong, #2a2a30)",
          borderRadius: 12,
          boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "85vh",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--border, #222226)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(239, 68, 68, 0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(239, 68, 68, 0.15)",
                color: "var(--red, #ef4444)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3
                id="error-modal-title"
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--text-primary, #ffffff)",
                }}
              >
                Error Details
              </h3>
              <span style={{ fontSize: 11, color: "var(--text-muted, #888)", display: "block" }}>
                {formattedDate}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setSelectedError(null)}
            style={{ padding: 6, borderRadius: 6, color: "var(--text-muted, #888)" }}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content Body */}
        <div style={{ padding: 18, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Summary Box */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 8,
              background: "var(--bg-elevated, #1a1a1f)",
              border: "1px solid var(--border, #26262c)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary, #fff)", marginBottom: 4 }}>
              {selectedError.title}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary, #ccc)", lineHeight: 1.5 }}>
              {selectedError.message}
            </div>
          </div>

          {/* Details / Stack Trace */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  color: "var(--text-muted, #888)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Terminal size={12} />
                Technical Stack / Response Payload
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleCopy}
                style={{
                  fontSize: 11,
                  padding: "4px 8px",
                  gap: 4,
                  color: copied ? "var(--green, #22c55e)" : "var(--text-secondary, #ccc)",
                }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copied!" : "Copy Details"}
              </button>
            </div>
            <pre
              style={{
                margin: 0,
                padding: 14,
                borderRadius: 8,
                background: "#09090b",
                border: "1px solid var(--border-strong, #2a2a32)",
                color: "#f87171",
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 11,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxHeight: 280,
                overflowY: "auto",
              }}
            >
              {selectedError.details || selectedError.message || "No stack trace or additional details recorded."}
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "12px 18px",
            borderTop: "1px solid var(--border, #222226)",
            background: "var(--bg-elevated, #16161a)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setSelectedError(null)}
            style={{ fontSize: 12 }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
