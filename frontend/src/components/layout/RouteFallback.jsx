import { Link } from "react-router-dom";

export function RouteFallback() {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" />
      Loading…
    </div>
  );
}

export function NotFound() {
  return (
    <div className="empty-state">
      <h3>Page not found</h3>
      <p>The route you tried doesn't exist. Head back to the dashboard.</p>
      <div style={{ marginTop: 16 }}>
        <Link to="/" className="btn btn-primary btn-sm">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
