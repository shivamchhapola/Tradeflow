import { useMemo } from "react";
import {
  Sparkles,
  CheckCircle2,
  Lightbulb,
  AlertOctagon,
  BookOpenCheck,
  Eye,
} from "lucide-react";

// --- Parsers and Utilities ---
const SECTION_PATTERNS = [
  { key: "happened", label: "What happened", Icon: BookOpenCheck, regex: /^\s*(?:1[.)\s]+|#{1,3}\s+)?\*{0,2}\s*(?:What happened|Summary)\b\*{0,2}/i },
  { key: "rightwrong", label: "Where it went right or wrong", Icon: AlertOctagon, regex: /^\s*(?:2[.)\s]+|#{1,3}\s+)?\*{0,2}\s*(?:Where it went right or wrong|Where it went right|Where it went wrong|Right\/wrong|What worked)\*{0,2}/i },
  { key: "textbook", label: "Textbook mechanics", Icon: Lightbulb, regex: /^\s*(?:3[.)\s]+|#{1,3}\s+)?\*{0,2}\s*(?:Textbook|What the textbook says|Mechanics)\*{0,2}/i },
  { key: "verdict", label: "Verdict on process", Icon: CheckCircle2, regex: /^\s*(?:4[.)\s]+|#{1,3}\s+)?\*{0,2}\s*(?:Verdict|Process verdict)\*{0,2}/i },
  { key: "watch", label: "One thing to watch", Icon: Eye, regex: /^\s*(?:5[.)\s]+|#{1,3}\s+)?\*{0,2}\s*(?:One thing to watch(?: next time)?|Takeaway|Next time)\*{0,2}/i },
];

const SECTION_COLORS = {
  happened:   { bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.25)",  icon: "#3b82f6" },
  rightwrong: { bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.25)",   icon: "#ef4444" },
  textbook:   { bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.25)",  icon: "#f59e0b" },
  verdict:    { bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.25)",   icon: "#22c55e" },
  watch:      { bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.25)", icon: "#a78bfa" },
  intro:      { bg: "rgba(45,212,191,0.08)",  border: "rgba(45,212,191,0.25)",  icon: "var(--accent)" },
};

export function parseReport(raw) {
  if (!raw) return null;
  const lines = String(raw).split(/\r?\n/);
  const sections = [];
  let current = null;

  for (const line of lines) {
    const matched = SECTION_PATTERNS.find((p) => p.regex.test(line));
    if (matched) {
      if (current) sections.push(current);
      let bodyText = line.replace(matched.regex, "").trim();
      bodyText = bodyText.replace(/^[\s*\-—:·•]+/, "").trim();
      current = { ...matched, body: bodyText };
    } else if (current) {
      current.body += (current.body ? "\n" : "") + line;
    } else {
      if (line.trim()) {
        current = { key: "intro", label: "Summary", Icon: BookOpenCheck, body: line };
      }
    }
  }
  if (current) sections.push(current);

  sections.forEach((s) => {
    s.body = s.body.replace(/^\s+|\s+$/g, "");
  });

  return sections.length > 0 ? sections : null;
}

export default function MentorReportDrawer({ reportText }) {
  const sections = useMemo(() => parseReport(reportText), [reportText]);

  if (!sections) {
    return (
      <div className="mentor-report-drawer">
        <div className="mentor-report-header">
          <Sparkles size={13} className="mentor-sparkle-icon" />
          Mentor Review
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
          {reportText}
        </div>
      </div>
    );
  }

  return (
    <div className="mentor-report-drawer">
      <div className="mentor-report-header">
        <Sparkles size={13} className="mentor-sparkle-icon" />
        Mentor Review
      </div>
      <div className="mentor-sections-grid">
        {sections.map((s) => {
          const Icon = s.Icon || BookOpenCheck;
          const colors = SECTION_COLORS[s.key] || SECTION_COLORS.intro;
          return (
            <div
              key={s.key}
              className="mentor-section-tile"
              style={{
                background: colors.bg,
                borderColor: colors.border,
              }}
            >
              <div className="mentor-section-tile-header">
                <Icon size={14} color={colors.icon} style={{ flexShrink: 0 }} />
                <span className="mentor-section-tile-label" style={{ color: colors.icon }}>
                  {s.label}
                </span>
              </div>
              <p className="mentor-section-tile-body">{s.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
