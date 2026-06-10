import { useState } from "react";
import { Lightbulb, Target, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { getBeginnerTranslation } from "./TooltipHelpers";

const GRADE_COLOR = {
  A: "var(--green)",
  B: "var(--blue)",
  C: "var(--amber)",
};

export default function PlaybookCard({ data, score, metrics }) {
  const grade = metrics?.grade ?? "C";
  const gradeColor = GRADE_COLOR[grade] ?? GRADE_COLOR.C;
  const sessionLabel = data?.session?.label;
  const beginner = getBeginnerTranslation(score, metrics, sessionLabel);
  const reasoning = data?.playbook_reasoning;
  const warning = metrics?.warning;
  // Show the "More context" toggle when there's *any* extra material to expand
  // (long mentor narrative, scenario reasoning, or both).
  const hasMore = (beginner && beginner.length > 140) || Boolean(reasoning);
  const [open, setOpen] = useState(false);

  return (
    <div className="playbook-card">
      {/* Header — kept minimal. Grade is no longer repeated here; it lives
          loudly on the ScoreCard already. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <Target size={14} color={gradeColor} />
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: gradeColor,
          }}
        >
          Today's objective
        </span>
      </div>

      {/* Scenario title + (optional) warning sub-row. The detailed reasoning
          paragraph used to live here, but it duplicated the mentor's take
          immediately below. Reasoning now hides behind the "More context"
          toggle so the visible card is just title → action → expand. */}
      <div
        style={{
          borderLeft: `3px solid ${gradeColor}`,
          paddingLeft: 14,
          marginBottom: 24,
        }}
      >
        <div className="playbook-title">{data?.playbook_title}</div>
        {warning && (
          <div
            role="status"
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              fontSize: 12,
              color: "var(--amber)",
              lineHeight: 1.5,
            }}
          >
            <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{warning}</span>
          </div>
        )}
      </div>

      {/* Mentor's take — the action + optional long-form coaching */}
      <div
        style={{
          padding: 14,
          background: "rgba(255,255,255,0.03)",
          borderRadius: "var(--radius-sm)",
          borderLeft: "3px solid var(--accent)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 8,
            color: "var(--text-primary)",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          <Lightbulb size={14} color="var(--accent)" />
          Mentor's take
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-primary)",
            marginBottom: 10,
            lineHeight: 1.55,
          }}
        >
          <strong style={{ color: "var(--accent)" }}>The move: </strong>
          {data?.playbook_action}
        </div>

        {/* Expanded view: short mentor blurb is always inline; long blurb +
            scenario reasoning live behind the toggle. */}
        {beginner && beginner.length <= 140 && (
          <div
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            {beginner}
          </div>
        )}
        {open && beginner && beginner.length > 140 && (
          <div
            className="reveal-fast"
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              marginBottom: reasoning ? 12 : 0,
            }}
          >
            {beginner}
          </div>
        )}
        {open && reasoning && (
          <div
            className="reveal-fast"
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              lineHeight: 1.55,
              paddingTop: 10,
              borderTop: "1px solid var(--border)",
            }}
          >
            <strong style={{ color: "var(--text-secondary)", marginRight: 6 }}>Why:</strong>
            {reasoning}
          </div>
        )}

        {hasMore && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{
              marginTop: 8,
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              cursor: "pointer",
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {open ? "Less" : "More context"}
            {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>
    </div>
  );
}
