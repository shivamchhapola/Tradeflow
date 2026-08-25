import { useAuth } from "../../context/AuthContext";
import { Trophy, ShieldCheck, Flame, PenTool, GraduationCap, Target, CheckCircle2, Lock } from "lucide-react";

const BADGES = [
  {
    id: "first_thesis",
    title: "First Thesis",
    desc: "Wrote a thesis (≥30 chars) before opening a paper trade.",
    icon: PenTool,
    category: "learning",
  },
  {
    id: "stop_respected",
    title: "Stop Respected",
    desc: "Set and respected your stop-loss without canceling it.",
    icon: ShieldCheck,
    category: "discipline",
  },
  {
    id: "consistent",
    title: "Consistent Trader",
    desc: "5 consecutive trading days with XP-earning activity.",
    icon: Flame,
    category: "consistency",
  },
  {
    id: "perfect_score",
    title: "Clean Run",
    desc: "Scored 3/3 correct answers on 5 daily quests.",
    icon: Trophy,
    category: "mastery",
  },
  {
    id: "quest_streak",
    title: "Quest Streak",
    desc: "Completed 5 daily quests in a row.",
    icon: Target,
    category: "consistency",
  },
  {
    id: "student",
    title: "Academy Scholar",
    desc: "Reviewed all foundational market learning modules.",
    icon: GraduationCap,
    category: "learning",
  },
];

export default function AchievementsGrid() {
  const { stats } = useAuth();
  const unlocked = new Set(stats?.achievements || []);

  const total = BADGES.length;
  const unlockedCount = BADGES.filter((b) => unlocked.has(b.id)).length;
  const pct = Math.round((unlockedCount / total) * 100);

  return (
    <section className="achievements-section" style={{ marginTop: 32, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-main)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Trophy size={18} color="var(--amber)" />
            Achievements & Badges
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0 0" }}>
            Track your milestone rewards and mastery badges.
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <span className="pill pill-accent" style={{ fontSize: 12, fontWeight: 600 }}>
            {unlockedCount} / {total} Unlocked ({pct}%)
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 12,
        }}
      >
        {BADGES.map((badge) => {
          const isUnlocked = unlocked.has(badge.id);
          const Icon = badge.icon;

          return (
            <div
              key={badge.id}
              className={`card ${isUnlocked ? "achievement-unlocked" : "achievement-locked"}`}
              style={{
                padding: 14,
                borderRadius: "var(--radius)",
                border: isUnlocked
                  ? "1px solid var(--accent)"
                  : "1px solid var(--border)",
                background: isUnlocked
                  ? "var(--bg-card)"
                  : "var(--bg-muted, rgba(255,255,255,0.02))",
                opacity: isUnlocked ? 1 : 0.65,
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div
                  style={{
                    padding: 8,
                    borderRadius: 8,
                    background: isUnlocked ? "rgba(99, 102, 241, 0.15)" : "var(--bg-subtle, rgba(255,255,255,0.05))",
                    color: isUnlocked ? "var(--accent)" : "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-main)" }}>
                      {badge.title}
                    </span>
                    {isUnlocked ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--green)", fontWeight: 500 }}>
                        <CheckCircle2 size={12} /> Unlocked
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)" }}>
                        <Lock size={12} /> Locked
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0 0", lineHeight: 1.4 }}>
                    {badge.desc}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
