import { Flame, Zap } from "lucide-react";
import Pill from "../ui/Pill";
import useStats from "../../hooks/useStats";

/**
 * Compact streak/XP/level row. The same trio is also rendered in the global
 * nav (via NavStats in App.jsx) — both subscribe to the same useStats cache,
 * so there's only ever one `/api/stats` request in flight.
 */
export default function StreakBar() {
  const { stats } = useStats();
  if (!stats) return null;

  const xp = stats.total_xp ?? 0;
  const streak = stats.streak_days ?? 0;
  const level = Math.floor(xp / 500) + 1;

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <Pill
        variant={streak > 0 ? "amber" : "muted"}
        icon={
          <Flame
            size={11}
            color={streak > 0 ? "var(--streak)" : "var(--text-muted)"}
            style={{
              filter: streak > 0 ? "drop-shadow(0 0 3px rgba(251,146,60,0.5))" : "none",
            }}
          />
        }
      >
        <span className="mono">{streak}</span> days
      </Pill>
      <Pill variant="xp" icon={<Zap size={11} />}>
        <span className="mono">{xp}</span> XP
      </Pill>
      <Pill variant="muted">
        Lv <span className="mono" style={{ marginLeft: 2 }}>{level}</span>
      </Pill>
    </div>
  );
}
