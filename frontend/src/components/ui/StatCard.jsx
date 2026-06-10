/**
 * StatCard — single stat tile.
 * Variants:
 *   "default" — grid tile
 *   "hero"    — bigger top-of-page card
 * `tone` controls value color: "up" | "down" | "neutral" | "amber" | "xp".
 */
const TONE_COLOR = {
  up: "var(--green)",
  down: "var(--red)",
  neutral: "var(--text-primary)",
  amber: "var(--amber)",
  xp: "var(--xp)",
  accent: "var(--accent)",
};

export default function StatCard({
  value,
  label,
  hint,
  tone = "neutral",
  variant = "default",
  icon,
}) {
  const valueColor = TONE_COLOR[tone] ?? TONE_COLOR.neutral;
  return (
    <div className={`stat-card${variant === "hero" ? " hero" : ""}`}>
      {(label || icon) && (
        <div
          className="stat-label"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginTop: 0,
            marginBottom: "10px",
          }}
        >
          {icon}
          {label}
        </div>
      )}
      <div className="stat-value mono" style={{ color: valueColor }}>
        {value}
      </div>
      {hint && (
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            marginTop: 6,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
