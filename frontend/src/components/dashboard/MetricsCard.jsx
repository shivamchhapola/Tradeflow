import { useRef } from "react";
import { HelpCircle, Activity, Clock, Scale, LineChart, AlertTriangle } from "lucide-react";
import { DASHBOARD } from "../../lib/copy";
import useAnimatedSize from "../../hooks/useAnimatedSize";

// ── Static metric definitions ────────────────────────────────────────────────
// `conviction` is intentionally NOT here — the same A/B/C is already loud on
// the ScoreCard (big grade circle), so repeating it in a row was duplicate
// information. Metrics is for the 4 technical reads that ScoreCard doesn't
// expose directly.
const METRICS = [
  {
    key: "volatility",
    label: "Volatility",
    Icon: Activity,
    tip: "How wide the swings are likely to be. High = sharp moves. Low = sleepy.",
  },
  {
    key: "theta_risk",
    label: "Theta risk",
    Icon: Clock,
    tip: "Time decay pressure. High theta = options bleed value if the market sits still.",
  },
  {
    key: "favorability",
    label: "Favorability",
    Icon: Scale,
    tip: "Who has the edge — buyers (need big moves) or sellers (need chop).",
  },
  {
    key: "structure",
    label: "Structure",
    Icon: LineChart,
    tip: "Expected day shape based on pre-market momentum.",
  },
];

// ── Per-metric → { color, tooltip } derivation ────────────────────────────────
// Matches the literal strings emitted by backend/engine/playbook.py.
function deriveValueMeta(key, val) {
  if (!val) {
    return { color: "var(--text-primary)", tooltip: "Value not yet computed." };
  }
  const v = val.toLowerCase();

  switch (key) {
    case "volatility":
      if (v.includes("expansion"))
        return { color: "var(--amber)", tooltip: "High expansion: large swings expected. Quick edges, but stops must be honoured — moves can reverse fast." };
      if (v.includes("contraction"))
        return { color: "var(--blue)", tooltip: "Volatility contracted: prices stuck in a tight range. Theta will drain OTM options fast — avoid holding them." };
      if (v.includes("directional"))
        return { color: "var(--green)", tooltip: "Directional volatility: clean moves without heavy whipsaws. Good conditions for a trend trade." };
      return { color: "var(--text-secondary)", tooltip: "Volatility is in a normal range for the session. Stick to standard risk sizing." };

    case "theta_risk":
      if (v.includes("extreme"))
        return { color: "var(--red)", tooltip: "Extreme time decay: OTM options bleed value extremely fast in this environment. Avoid buying OTM premium." };
      if (v.includes("high"))
        return { color: "var(--amber)", tooltip: "Elevated time decay pressure. Options lose value quickly if the market sits still." };
      if (v.includes("low"))
        return { color: "var(--green)", tooltip: "Low time decay pressure. More room to hold a position without bleeding to time decay." };
      return { color: "var(--text-secondary)", tooltip: "Moderate time decay. Standard option-holding risk applies." };

    case "favorability":
      if (v.includes("buyers") || v.includes("directional"))
        return { color: "var(--green)", tooltip: "Conditions favour option buyers: large directional moves expected, premium expansion likely." };
      if (v.includes("sellers"))
        return { color: "var(--amber)", tooltip: "Conditions favour option sellers: choppy or range-bound action expected, premium decay works for you." };
      return { color: "var(--text-secondary)", tooltip: "Neither buyers nor sellers have a clear edge. Trade smaller or wait for a cleaner setup." };

    case "structure":
      if (v.includes("bullish"))
        return { color: "var(--green)", tooltip: "Trend day probable (bullish): market likely to pick an upward direction and sustain it. Avoid counter-trend shorts." };
      if (v.includes("bearish"))
        return { color: "var(--red)", tooltip: "Trend day probable (bearish): market likely to pick a downward direction and sustain it. Avoid counter-trend longs." };
      if (v.includes("directional"))
        return { color: "var(--blue)", tooltip: "Moderate directional bias: not a full trend day, but the market has a lean. Trade with the bias, not against it." };
      return { color: "var(--amber)", tooltip: "Compression / sideways structure expected. Range trading conditions — be cautious with directional bets." };

    default:
      return { color: "var(--text-primary)", tooltip: "" };
  }
}

// ── Risks-to-avoid — only shown when conditions actually warrant a warning ───
// Distinct from playbook ("what to do") — this lists what to NOT do.
function buildRisks(metrics) {
  if (!metrics) return [];
  const out = [];
  const theta = (metrics.theta_risk ?? "").toLowerCase();
  const vol   = (metrics.volatility ?? "").toLowerCase();
  const grade = metrics.grade ?? "";

  if (theta.includes("extreme")) out.push("Don't buy OTM premium — theta will eat it.");
  else if (theta.includes("high")) out.push("Avoid holding options past their thesis — theta bleed is elevated.");

  if (vol.includes("expansion")) out.push("Don't chase breakouts without a stop — reversals can be fast.");
  else if (vol.includes("contraction")) out.push("Don't size up looking for moves — the market is sleepy.");

  if (grade === "C") out.push("Don't take full-size positions — signals conflict.");

  return out;
}

// ── InfoIcon ─────────────────────────────────────────────────────────────────
const InfoIcon = ({ content, label = "More info" }) => (
  <button
    type="button"
    aria-label={label}
    data-tooltip-id="global-tooltip"
    data-tooltip-content={content}
    style={{
      background: "transparent",
      border: "none",
      padding: 0,
      cursor: "help",
      marginLeft: 4,
      opacity: 0.7,
      transition: "opacity 0.2s",
      display: "inline-flex",
      verticalAlign: "text-top",
      color: "inherit",
    }}
    onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
    onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.7)}
    onFocus={(e) => (e.currentTarget.style.opacity = 1)}
    onBlur={(e) => (e.currentTarget.style.opacity = 0.7)}
  >
    <HelpCircle size={13} />
  </button>
);

// ── Main card ────────────────────────────────────────────────────────────────
export default function MetricsCard({ metrics }) {
  const ref = useRef(null);
  useAnimatedSize(ref);

  const risks = buildRisks(metrics);

  return (
    <div className="card" ref={ref}>
      <div className="card-header" style={{ marginBottom: 12 }}>
        <span className="card-title">
          {DASHBOARD.metricsLabel}
          <InfoIcon content={DASHBOARD.metricsHelp} label="About market metrics" />
        </span>
      </div>

      {/* Metric rows — label on the left, color-coded value on the right */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {METRICS.map(({ key, label, tip, Icon }, idx) => {
          const rawValue = metrics?.[key];
          const value = rawValue ?? "—";
          const { color, tooltip } = deriveValueMeta(key, rawValue);
          return (
            <div
              key={key}
              className="metric-pair-row"
              style={{
                borderTop: idx === 0 ? "none" : "1px solid var(--border)",
              }}
            >
              <div className="metric-pair-label" style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <Icon size={14} color={color} style={{ opacity: 0.85, flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    letterSpacing: 0.5,
                  }}
                >
                  {label}
                </span>
                <InfoIcon content={tip} label={`About ${label.toLowerCase()}`} />
              </div>
              <span
                className="metric-pair-value"
                data-tooltip-id="global-tooltip"
                data-tooltip-content={tooltip}
                tabIndex={0}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color,
                  cursor: "help",
                }}
              >
                {value}
              </span>
            </div>
          );
        })}
      </div>

      {/* Risks — only shown when conditions warrant a warning */}
      {risks.length > 0 && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: "var(--amber)",
              marginBottom: 2,
            }}
          >
            <AlertTriangle size={11} />
            Watch out
          </div>
          {risks.map((r) => (
            <div
              key={r}
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                lineHeight: 1.5,
                paddingLeft: 17,
                position: "relative",
              }}
            >
              <span style={{ position: "absolute", left: 4, color: "var(--text-muted)" }}>·</span>
              {r}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
