import { useState, useMemo, useCallback } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ReferenceLine,
} from "recharts";
import { Wallet, Zap, ChevronDown, Trophy, TrendingUp, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

import { updateTradeThesis } from "../../api";
import Pill from "../ui/Pill";
import PnL from "../ui/PnL";
import { inr, inrCompact, signedInr, num as fmtNum, pct } from "../../lib/format";
import { formatISTDateShort, formatISTDate } from "../../lib/time";
import { EMPTY, PORTFOLIO } from "../../lib/copy";

const LEVEL_XP = 500;

export const BADGES = [
  { id: "first_thesis",   icon: "📝", name: "First Thesis",   unlock: "Wrote a thesis before opening your first trade" },
  { id: "stop_respected", icon: "🛡️", name: "Stop Respected", unlock: "Closed at the original SL without moving it" },
  { id: "consistent",     icon: "📅", name: "Consistent",     unlock: "5 consecutive trading days with XP-earning activity" },
  { id: "disciplined",    icon: "⚖️", name: "Disciplined",    unlock: "10 trades following the original stop loss" },
  { id: "student",        icon: "📚", name: "Student",        unlock: "Read every mentor report for 10 closed trades" },
  { id: "thesis_trader",  icon: "🎯", name: "Thesis Trader",  unlock: "Wrote a thesis on 20 consecutive trades" },
  { id: "quest_streak",   icon: "🔥", name: "Quest Streak",   unlock: "5 consecutive non-expired quests" },
  { id: "perfect_score",  icon: "🏆", name: "Perfect Score",  unlock: "5 quests with 100% correct" },
  { id: "first_report",   icon: "📜", name: "First Report",   unlock: "Read your first mentor report" },
];

export function BalanceCard({ balance, totalPnl, balancePct, isProfit }) {
  return (
    <div className={`pf-hero-card balance-card${isProfit ? "" : " losing"}`}>
      <div className="pf-hero-label">
        <Wallet size={12} />
        Virtual Balance
      </div>
      <div className={`pf-hero-value${isProfit ? " positive" : " negative"}`}>
        {inr(balance)}
      </div>
      <div className="pf-hero-sub">
        <Pill variant={isProfit ? "bull" : "bear"}>
          <TrendingUp size={10} />
          {pct(balancePct, 2)} from ₹5L
        </Pill>
        <span
          className="pf-hero-secondary"
          style={{ color: totalPnl >= 0 ? "var(--green)" : "var(--red)" }}
        >
          {signedInr(totalPnl)}
        </span>
      </div>
    </div>
  );
}

export function XpCard({ xp, xpLevel, xpInLevel, xpProgress }) {
  return (
    <div className="pf-hero-card xp-card">
      <div className="pf-xp-header">
        <div className="pf-hero-label" style={{ margin: 0 }}>
          <Zap size={12} color="var(--xp)" />
          {PORTFOLIO.level(xpLevel)}
        </div>
        <span className="pf-xp-count">{fmtNum(xp)} XP</span>
      </div>
      <div className="pf-xp-value">Lv {xpLevel}</div>
      <div className="pf-xp-bar">
        <div className="pf-xp-bar-fill" style={{ width: `${xpProgress}%` }} />
      </div>
      <div className="pf-xp-footer">{PORTFOLIO.toNext(LEVEL_XP - xpInLevel)}</div>
    </div>
  );
}

export function EquityCurve({ history }) {
  const series = useMemo(() => {
    if (!history?.length) return [];
    const sorted = [...history]
      .filter((t) => t.closed_at && Number.isFinite(Number(t.pnl)))
      .sort((a, b) => new Date(a.closed_at) - new Date(b.closed_at));
    let acc = 0;
    return sorted.map((t, i) => {
      acc += Number(t.pnl);
      return { date: formatISTDateShort(t.closed_at), cum: acc, trade: i + 1 };
    });
  }, [history]);

  if (!series.length) return null;

  const last = series[series.length - 1].cum;
  const tone = last >= 0 ? "var(--green)" : "var(--red)";
  const toneFade = last >= 0 ? "rgba(34,197,94,0)" : "rgba(239,68,68,0)";
  const toneSolid = last >= 0 ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)";

  return (
    <div className="pf-equity-card">
      <div className="pf-equity-header">
        <div>
          <div className="pf-equity-title">{PORTFOLIO.equityCurve}</div>
          <div className="pf-equity-meta">{series.length} closed trades</div>
        </div>
        <div className="pf-equity-pnl" style={{ color: tone }}>
          {signedInr(last)}
        </div>
      </div>
      <div className="pf-equity-chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={toneSolid} />
                <stop offset="95%" stopColor={toneFade} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: "var(--text-muted)" }}
              interval="preserveStartEnd"
            />
            <YAxis
              hide={false}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: "var(--text-muted)" }}
              tickFormatter={(v) => inrCompact(v)}
              width={52}
            />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
            <RTooltip
              contentStyle={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-strong)",
                borderRadius: 8,
                fontSize: 11,
              }}
              labelStyle={{ color: "var(--text-muted)" }}
              formatter={(v) => [signedInr(v), "Cumulative P&L"]}
            />
            <Area
              type="monotone"
              dataKey="cum"
              stroke={tone}
              strokeWidth={2}
              fill="url(#equityGrad)"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function StatsGrid({ stats, profitFactor, rr }) {
  const winRate = stats.win_rate ?? 0;
  const pfDisplay =
    profitFactor === Infinity
      ? "∞"
      : profitFactor === 0
      ? "—"
      : profitFactor.toFixed(2);

  const avgWin = stats.avg_win ?? 0;
  const avgLoss = stats.avg_loss ?? 0;

  const metrics = [
    {
      value: `${winRate.toFixed(0)}%`,
      label: PORTFOLIO.stats.winRate,
      tone: winRate >= 50 ? "up" : winRate > 0 ? "neutral" : "down",
      hint: winRate >= 50 ? "Above average" : winRate > 0 ? "Keep improving" : "No trades yet",
    },
    {
      value: fmtNum(stats.total_trades ?? 0),
      label: PORTFOLIO.stats.totalTrades,
      tone: "neutral",
      hint: `${stats.total_trades ?? 0} closed`,
    },
    {
      value: inrCompact(avgWin),
      label: PORTFOLIO.stats.avgWin,
      tone: "up",
      hint: "Per winning trade",
    },
    {
      value: inrCompact(Math.abs(avgLoss)),
      label: PORTFOLIO.stats.avgLoss,
      tone: "down",
      hint: "Per losing trade",
    },
    {
      value: rr,
      label: "Reward : Risk",
      tone: typeof rr === "string" && parseFloat(rr) >= 1 ? "up" : "down",
      hint: "Avg win ÷ avg loss",
    },
    {
      value: pfDisplay,
      label: "Profit Factor",
      tone:
        profitFactor === Infinity || profitFactor >= 1.5
          ? "up"
          : profitFactor >= 1
          ? "amber"
          : "down",
      hint: "Gross wins ÷ losses",
    },
    {
      value: fmtNum(stats.streak_days ?? 0),
      label: PORTFOLIO.stats.streak,
      tone: "amber",
      hint: "Consecutive days",
    },
    {
      value: inrCompact(Math.abs(stats.max_drawdown ?? 0)),
      label: PORTFOLIO.stats.drawdown,
      tone: "down",
      hint: "Peak to trough",
    },
  ];

  return (
    <div className="pf-stats-grid">
      {metrics.map((m) => (
        <div key={m.label} className={`pf-metric-card${m.tone !== "neutral" ? ` tone-${m.tone}` : ""}`}>
          <div className="pf-metric-value">{m.value}</div>
          <div className="pf-metric-label">{m.label}</div>
          {m.hint && <div className="pf-metric-hint">{m.hint}</div>}
        </div>
      ))}
    </div>
  );
}

export function InsightsRow({ history }) {
  const closed = history.filter((t) => t.closed_at && Number.isFinite(Number(t.pnl)));
  if (!closed.length) return null;

  const best  = [...closed].sort((a, b) => Number(b.pnl) - Number(a.pnl))[0];
  const worst = [...closed].sort((a, b) => Number(a.pnl) - Number(b.pnl))[0];

  const exitCounts = closed.reduce((acc, t) => {
    acc[t.exit_reason] = (acc[t.exit_reason] || 0) + 1;
    return acc;
  }, {});

  const total = closed.length;
  const exitRows = [
    { key: "target_hit", label: "Target hit",  cls: "target" },
    { key: "stop_hit",   label: "Stop hit",    cls: "stop" },
    { key: "manual",     label: "Manual",      cls: "manual" },
    { key: "auto_squareoff", label: "Auto sq-off", cls: "auto" },
  ].filter((r) => exitCounts[r.key]);

  return (
    <div className="pf-insights-row">
      <div className="pf-insight-card">
        <div className="pf-insight-label">Best Trade</div>
        {best ? (
          <>
            <div className="pf-insight-instrument">{best.instrument}</div>
            <div className="pf-insight-pnl positive">{signedInr(Number(best.pnl))}</div>
          </>
        ) : (
          <span className="pf-insight-empty">—</span>
        )}
      </div>

      <div className="pf-insight-card">
        <div className="pf-insight-label">Worst Trade</div>
        {worst ? (
          <>
            <div className="pf-insight-instrument">{worst.instrument}</div>
            <div className="pf-insight-pnl negative">{signedInr(Number(worst.pnl))}</div>
          </>
        ) : (
          <span className="pf-insight-empty">—</span>
        )}
      </div>

      <div className="pf-insight-card">
        <div className="pf-insight-label">How Trades Closed</div>
        <div className="pf-exit-reasons">
          {exitRows.map(({ key, label, cls }) => (
            <div key={key} className="pf-exit-row">
              <span className="pf-exit-name">{label}</span>
              <div className="pf-exit-bar-track">
                <div
                  className={`pf-exit-bar-fill ${cls}`}
                  style={{ width: `${((exitCounts[key] || 0) / total) * 100}%` }}
                />
              </div>
              <span className="pf-exit-count">{exitCounts[key] || 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BadgesSection({ stats }) {
  const earned = useMemo(
    () => new Set(stats?.achievements || []),
    [stats]
  );

  const earnedCount = earned.size;

  return (
    <div className="pf-badges-card">
      <div className="pf-badges-header">
        <span className="card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Trophy size={12} color="var(--xp)" />
          Achievements
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {earnedCount} / {BADGES.length} earned
        </span>
      </div>
      <div className="pf-badges-grid">
        {BADGES.map((badge) => {
          const isEarned = earned.has(badge.id);
          return (
            <div
              key={badge.id}
              className={`pf-badge ${isEarned ? "earned" : "locked"}`}
              title={isEarned ? `Earned: ${badge.name}` : `Locked: ${badge.unlock}`}
            >
              <span className="pf-badge-icon">{isEarned ? badge.icon : "🔒"}</span>
              <span className="pf-badge-name">{badge.name}</span>
              {!isEarned && (
                <span className="pf-badge-unlock">{badge.unlock}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TradeHistory({ history, filter, setFilter, sort, setSort, onThesisUpdate }) {
  const [expandedId, setExpandedId] = useState(null);
  const [editingThesisId, setEditingThesisId] = useState(null);
  const [editThesisText, setEditThesisText] = useState("");
  const [savingThesisId, setSavingThesisId] = useState(null);

  const saveThesis = useCallback(async (tradeId) => {
    setSavingThesisId(tradeId);
    try {
      const res = await updateTradeThesis(tradeId, editThesisText);
      onThesisUpdate(tradeId, editThesisText, res.xp_awarded);
      if (res.xp_awarded > 0) toast.success(`Thesis saved · +${res.xp_awarded} XP 🎯`);
      else toast.success("Thesis updated");
      setEditingThesisId(null);
    } catch {
      toast.error("Failed to save thesis");
    } finally {
      setSavingThesisId(null);
    }
  }, [editThesisText, onThesisUpdate]);

  const filtered = useMemo(() => {
    let arr = history;
    if (filter === "wins")   arr = arr.filter((t) => Number(t.pnl) > 0);
    if (filter === "losses") arr = arr.filter((t) => Number(t.pnl) <= 0);
    const out = [...arr];
    out.sort((a, b) => {
      let x = a[sort.key];
      let y = b[sort.key];
      if (sort.key === "pnl") {
        x = Number(x) || 0; y = Number(y) || 0;
      } else if (sort.key === "closed_at") {
        x = a.closed_at ? new Date(a.closed_at).getTime() : 0;
        y = b.closed_at ? new Date(b.closed_at).getTime() : 0;
      }
      if (x < y) return sort.dir === "asc" ? -1 : 1;
      if (x > y) return sort.dir === "asc" ?  1 : -1;
      return 0;
    });
    return out;
  }, [history, filter, sort]);

  const onSort = (key) =>
    setSort((cur) =>
      cur.key === key ? { key, dir: cur.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }
    );

  const arrow = (key) => (sort.key === key ? (sort.dir === "asc" ? " ↑" : " ↓") : "");

  const toggleExpand = (id) => setExpandedId((cur) => (cur === id ? null : id));

  return (
    <div className="pf-history-card">
      <div className="pf-history-header">
        <span className="card-title">{PORTFOLIO.history}</span>
        <div className="chip-group" role="tablist">
          {[
            { id: "all",    label: PORTFOLIO.filters.all },
            { id: "wins",   label: PORTFOLIO.filters.wins },
            { id: "losses", label: PORTFOLIO.filters.losses },
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={filter === c.id}
              className={`chip ${filter === c.id ? "active" : ""}`}
              onClick={() => setFilter(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <h3>{EMPTY.noTrades.title}</h3>
          <p>{EMPTY.noTrades.body}</p>
        </div>
      ) : (
        <div className="pf-history-table-wrap">
          <table className="pf-table">
            <thead>
              <tr>
                <th>Instrument</th>
                <th>Side</th>
                <th className="num" onClick={() => onSort("pnl")} style={{ cursor: "pointer" }}>
                  P&amp;L{arrow("pnl")}
                </th>
                <th className="num">Entry</th>
                <th className="num">Exit</th>
                <th>Reason</th>
                <th>XP</th>
                <th
                  className="sortable"
                  onClick={() => onSort("closed_at")}
                >
                  Closed{arrow("closed_at")}
                </th>
                <th style={{ width: 24 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <>
                  <tr
                    key={t.id}
                    className={expandedId === t.id ? "expanded" : ""}
                    onClick={() => toggleExpand(t.id)}
                  >
                    <td style={{ fontWeight: 500 }}>{t.instrument}</td>
                    <td>
                      <Pill variant={t.direction === "BUY" ? "bull" : "bear"}>
                        {t.direction === "BUY" ? "LONG" : "SHORT"}
                      </Pill>
                    </td>
                    <td className="num">
                      <PnL value={t.pnl} />
                    </td>
                    <td className="num" style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                      {inr(t.entry_price)}
                    </td>
                    <td className="num" style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                      {inr(t.exit_price)}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {prettyReason(t.exit_reason)}
                    </td>
                    <td>
                      {t.xp_earned ? (
                        <span className="pf-xp-badge">+{t.xp_earned}</span>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {t.closed_at ? formatISTDate(t.closed_at) : "—"}
                    </td>
                    <td>
                      <ChevronDown
                        size={13}
                        className={`pf-expand-chevron${expandedId === t.id ? " open" : ""}`}
                      />
                    </td>
                  </tr>
                  {expandedId === t.id && (
                    <tr key={`${t.id}-exp`} className="expand-row">
                      <td colSpan={9}>
                        <div className="pf-expand-content">
                          <div className="pf-expand-item">
                            <span className="pf-expand-key">Stop Loss</span>
                            <span className="pf-expand-val">
                              {t.stop_loss != null ? inr(t.stop_loss) : "—"}
                            </span>
                          </div>
                          <div className="pf-expand-item">
                            <span className="pf-expand-key">Target</span>
                            <span className="pf-expand-val">
                              {t.target != null ? inr(t.target) : "—"}
                            </span>
                          </div>
                          <div className="pf-expand-item">
                            <span className="pf-expand-key">Quantity</span>
                            <span className="pf-expand-val">{t.quantity ?? "—"}</span>
                          </div>
                          <div className="pf-expand-item" style={{ gridColumn: "span 2" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              <span className="pf-expand-key">Thesis</span>
                              {!t.thesis && (
                                <span style={{ fontSize: 9, color: "var(--xp)", fontWeight: 700 }}>+15 XP</span>
                              )}
                              {editingThesisId !== t.id && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingThesisId(t.id);
                                    setEditThesisText(t.thesis || "");
                                  }}
                                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex" }}
                                  title="Edit thesis"
                                >
                                  <Pencil size={11} />
                                </button>
                              )}
                            </div>
                            {editingThesisId === t.id ? (
                              <div onClick={(e) => e.stopPropagation()}>
                                <textarea
                                  rows={3}
                                  autoFocus
                                  value={editThesisText}
                                  onChange={(e) => setEditThesisText(e.target.value)}
                                  placeholder="Why did you take this trade?"
                                  style={{
                                    width: "100%",
                                    resize: "vertical",
                                    minHeight: 56,
                                    background: "var(--bg-elevated)",
                                    border: "1px solid var(--border-strong)",
                                    borderRadius: "var(--radius-sm)",
                                    color: "var(--text-primary)",
                                    fontFamily: "var(--font)",
                                    fontSize: 12,
                                    padding: "7px 10px",
                                    lineHeight: 1.5,
                                    outline: "none",
                                  }}
                                />
                                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                                  <button
                                    type="button"
                                    onClick={() => saveThesis(t.id)}
                                    disabled={savingThesisId === t.id}
                                    style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--green)", background: "var(--green-bg)", border: "1px solid var(--green-border)", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
                                  >
                                    <Check size={11} />
                                    {savingThesisId === t.id ? "Saving…" : "Save"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setEditingThesisId(null); }}
                                    style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
                                  >
                                    <X size={11} />
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <span className="pf-expand-val thesis">
                                {t.thesis?.trim() || <em style={{ color: "var(--text-muted)" }}>No thesis — click ✏️ to add one</em>}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function prettyReason(r) {
  switch (r) {
    case "target_hit":     return "Target hit";
    case "stop_hit":       return "Stop hit";
    case "manual":         return "Manual";
    case "auto_squareoff": return "Auto sq-off";
    default:               return r ?? "—";
  }
}
