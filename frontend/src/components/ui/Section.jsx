/**
 * Section — a card with a consistent header (title + optional right slot).
 */
export default function Section({ title, hint, right, children, className = "", padded = true }) {
  return (
    <div className={`card ${className}`.trim()} style={padded ? undefined : { padding: 0 }}>
      {(title || right) && (
        <div className="card-header" style={{ marginBottom: padded ? 16 : 0, padding: padded ? 0 : "16px 16px 0" }}>
          <span className="card-title" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {title}
            {hint}
          </span>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}
