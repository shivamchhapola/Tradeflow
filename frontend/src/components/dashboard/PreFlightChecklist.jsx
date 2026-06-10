import { useState } from "react";
import { CheckSquare, ArrowRight, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getChecklist } from "./TooltipHelpers";

export default function PreFlightChecklist({ score, metrics, sessionLabel }) {
  const checklist = getChecklist(score, metrics, sessionLabel);
  const [checked, setChecked] = useState({});
  const navigate = useNavigate();

  const toggleCheck = (i) => setChecked((prev) => ({ ...prev, [i]: !prev[i] }));
  const checkedCount = Object.values(checked).filter(Boolean).length;
  const allDone = checkedCount === checklist.length && checklist.length > 0;
  const progress = checklist.length > 0 ? (checkedCount / checklist.length) * 100 : 0;

  return (
    <div className="card">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CheckSquare size={16} color={allDone ? "var(--green)" : "var(--accent)"} />
          Pre-flight checklist
        </div>
        <span
          className="mono"
          style={{ fontSize: 11, color: "var(--text-muted)" }}
        >
          {checkedCount}/{checklist.length}
        </span>
      </div>

      <div
        aria-hidden
        style={{
          height: 3,
          background: "var(--bg-surface)",
          borderRadius: 2,
          marginBottom: 14,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: allDone ? "var(--green)" : "var(--accent)",
            borderRadius: 2,
            transition: "width 0.4s ease, background 0.4s ease",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {checklist.map((task, i) => {
          const isChecked = checked[i] ?? false;
          return (
            <button
              key={i}
              type="button"
              role="checkbox"
              aria-checked={isChecked}
              onClick={() => toggleCheck(i)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "11px 12px",
                borderRadius: "var(--radius-sm)",
                border: `1px solid ${
                  isChecked ? "var(--green-border)" : "var(--border)"
                }`,
                background: isChecked
                  ? "var(--green-bg)"
                  : "rgba(255,255,255,0.02)",
                cursor: "pointer",
                transition: "all 0.25s ease",
                userSelect: "none",
                fontFamily: "var(--font)",
                textAlign: "left",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 5,
                  border: `2px solid ${
                    isChecked ? "var(--green)" : "var(--border-strong)"
                  }`,
                  background: isChecked ? "var(--green)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 1,
                  transition: "all 0.2s ease",
                }}
              >
                {isChecked && <Check size={11} color="#062b15" strokeWidth={3} />}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: isChecked ? "var(--text-muted)" : "var(--text-primary)",
                  lineHeight: 1.4,
                  textDecoration: isChecked ? "line-through" : "none",
                  textDecorationColor: "var(--green)",
                  transition: "all 0.25s ease",
                }}
              >
                {task}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={allDone ? () => navigate("/trade") : undefined}
        disabled={!allDone}
        className={`btn btn-block ${allDone ? "btn-quest" : "btn-ghost"}`}
        style={{ marginTop: 14 }}
      >
        Ready to trade
        <ArrowRight size={14} />
      </button>
    </div>
  );
}
