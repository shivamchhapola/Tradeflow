import { HelpCircle } from "lucide-react";
import { getBiasTooltip, getGradeTooltip } from "./TooltipHelpers";
import { getBiasMeterFill } from "../../lib/biasVisual";
import { score as fmtScore } from "../../lib/format";
import { DASHBOARD } from "../../lib/copy";
import ScoreSparkline from "./ScoreSparkline";

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
      marginLeft: 6,
      opacity: 0.5,
      transition: "opacity 0.2s",
      display: "inline-flex",
      verticalAlign: "text-top",
      color: "inherit",
    }}
    onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
    onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.5)}
    onFocus={(e) => (e.currentTarget.style.opacity = 1)}
    onBlur={(e) => (e.currentTarget.style.opacity = 0.5)}
  >
    <HelpCircle size={14} />
  </button>
);

const GRADE_CONFIG = {
  A: {
    color: "var(--green)",
    glow: "rgba(34, 197, 94, 0.35)",
    bg: "rgba(34, 197, 94, 0.08)",
  },
  B: {
    color: "var(--blue)",
    glow: "rgba(59, 130, 246, 0.35)",
    bg: "rgba(59, 130, 246, 0.08)",
  },
  C: {
    color: "var(--amber)",
    glow: "rgba(245, 158, 11, 0.35)",
    bg: "rgba(245, 158, 11, 0.08)",
  },
};

export default function ScoreCard({ score, metrics, scoreClass, biasLabelClass, marketBias }) {
  const grade = metrics.grade ?? "C";
  const gc = GRADE_CONFIG[grade] ?? GRADE_CONFIG.C;
  const meter = getBiasMeterFill(score);

  const meterFillStyle =
    meter.tone === "bullish"
      ? {
          background: "var(--green)",
          boxShadow: "0 0 12px rgba(34, 197, 94, 0.4)",
        }
      : meter.tone === "bearish"
      ? {
          background: "var(--red)",
          boxShadow: "0 0 12px rgba(239, 68, 68, 0.4)",
        }
      : {
          background: "rgba(148, 163, 184, 0.42)",
          boxShadow: "0 0 8px rgba(148, 163, 184, 0.2)",
        };

  return (
    <div className="card">
      <div className="card-header" style={{ marginBottom: 0 }}>
        <span className="card-title">
          {DASHBOARD.scoreLabel}
          <InfoIcon content={DASHBOARD.scoreHelp} label="About macro bias score" />
        </span>
      </div>

      <div className="score-card-score-row">
        <div
          className="score-value-wrap"
          data-tooltip-id="global-tooltip"
          data-tooltip-content={getBiasTooltip(score)}
        >
          <div
            className={`score-value ${scoreClass}`}
            style={{ cursor: "help" }}
            aria-live="polite"
            aria-atomic="true"
          >
            {fmtScore(score)}
          </div>
        </div>

        <div
          className="grade-circle"
          data-tooltip-id="global-tooltip"
          data-tooltip-content={getGradeTooltip(grade)}
          tabIndex={0}
          aria-label={`Conviction grade ${grade}`}
          style={{
            borderRadius: "50%",
            border: `3px solid ${gc.color}`,
            boxShadow: `0 0 14px ${gc.glow}, inset 0 0 10px ${gc.bg}`,
            background: gc.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            color: gc.color,
            flexShrink: 0,
            transition: "all 0.3s ease",
            cursor: "help",
            fontFamily: "var(--font-mono)",
          }}
        >
          {grade}
        </div>
      </div>

      <div className="bias-meter">
        <div className="bias-meter-track-shell">
          <div className="bias-meter-zero-line" aria-hidden />
          <div className="bias-meter-track">
            {meter.widthPct > 0 && (
              <div
                className="bias-meter-fill"
                style={{
                  left: `${meter.leftPct}%`,
                  width: `${meter.widthPct}%`,
                  ...meterFillStyle,
                }}
              />
            )}
          </div>
        </div>

        <div className="bias-meter-labels">
          <span>BEARISH</span>
          <span className="bias-meter-label-zero">0</span>
          <span>BULLISH</span>
        </div>
      </div>

      <div
        className={`bias-label ${biasLabelClass}`}
        style={{
          marginTop: 12,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: 0.5,
        }}
      >
        {marketBias}
      </div>

      <div style={{ marginTop: 12 }}>
        <ScoreSparkline />
      </div>

      <div className="signal-dots" role="img" aria-label="Signal alignment dots">
        {Array.from({ length: 6 }, (_, i) => {
          let cls = "";
          if (i < (metrics.bullish_signals ?? 0)) cls = "bull";
          else if (i >= 6 - (metrics.bearish_signals ?? 0)) cls = "bear";
          return <div key={i} className={`signal-dot ${cls}`} />;
        })}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
        {metrics.alignment}{" "}
        <span style={{ opacity: 0.6 }}>·</span>{" "}
        {DASHBOARD.alignmentHint(metrics.bullish_signals ?? 0, metrics.bearish_signals ?? 0)}
      </div>
    </div>
  );
}
