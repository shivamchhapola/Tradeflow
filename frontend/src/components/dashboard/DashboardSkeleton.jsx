/**
 * Ghost layout for Dashboard's first load.
 *
 * Mirrors the real grid (Score / Warning area / Playbook on the left;
 * QuestCard / GlobalMarkets / MetricsCard slot on the right) so the
 * page doesn't reshape when actual data lands. Pure CSS — no JS work
 * during the most expensive moment of the page lifecycle.
 *
 * Each ghost block uses .card sizing + .skeleton shimmer so the visual
 * weight matches a real card. Heights are tuned to the typical filled
 * heights, not arbitrary placeholders.
 */
export default function DashboardSkeleton() {
  return (
    <div className="page dashboard-skeleton" aria-busy="true" aria-live="polite">
      {/* Title row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          gap: 12,
        }}
      >
        <div className="skeleton" style={{ height: 22, width: 220, borderRadius: 4 }} />
        <div className="skeleton" style={{ height: 32, width: 32, borderRadius: 6 }} />
      </div>

      <div className="dashboard-grid">
        <div className="stack">
          {/* ScoreCard */}
          <GhostCard height={210} lines={[80, 60, 40]} />
          {/* PlaybookCard */}
          <GhostCard height={260} lines={[70, 90, 60, 50]} />
        </div>

        <div className="stack">
          {/* QuestCard */}
          <GhostCard height={300} lines={[60, 80, 70, 70]} />
          {/* GlobalMarketsTable */}
          <GhostCard height={340} lines={[100, 100, 100, 100, 100]} dense />
        </div>
      </div>
    </div>
  );
}

function GhostCard({ height, lines = [], dense = false }) {
  return (
    <div className="card" style={{ padding: dense ? 14 : 18 }}>
      <div
        className="skeleton"
        style={{ height: 14, width: 140, borderRadius: 4, marginBottom: 14 }}
      />
      <div
        className="skeleton"
        style={{ height: height - 60, width: "100%", borderRadius: 8, opacity: 0.55 }}
      />
      {lines.length > 0 && !dense && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          {lines.map((w, i) => (
            <div
              key={i}
              className="skeleton skeleton-line"
              style={{ width: `${w}%`, opacity: 0.4 }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
