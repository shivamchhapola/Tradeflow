import { Component } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * App-level error boundary so a thrown render (commonly from recharts on
 * malformed data) doesn't blank out the whole UI.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (typeof console !== "undefined") {
      console.error("ErrorBoundary caught:", error, info?.componentStack);
    }
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="main">
          <div
            className="card"
            style={{
              borderColor: "var(--red-border)",
              background: "var(--bg-card)",
              maxWidth: 520,
              margin: "48px auto",
              textAlign: "center",
            }}
          >
            <AlertTriangle
              size={28}
              color="var(--red)"
              style={{ marginBottom: 12 }}
            />
            <h2
              style={{
                fontSize: 16,
                fontWeight: 600,
                marginBottom: 8,
                color: "var(--text-primary)",
              }}
            >
              Something tripped
            </h2>
            <p
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                lineHeight: 1.6,
                marginBottom: 16,
              }}
            >
              The interface caught an error. Refresh the page or check that the backend
              is running on :8000.
            </p>
            <code
              style={{
                display: "block",
                fontSize: 11,
                color: "var(--text-muted)",
                background: "var(--bg-surface)",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                marginBottom: 16,
                fontFamily: "var(--font-mono)",
                wordBreak: "break-word",
              }}
            >
              {String(this.state.error?.message || this.state.error)}
            </code>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={this.handleReset}
              >
                Try again
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => window.location.reload()}
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
