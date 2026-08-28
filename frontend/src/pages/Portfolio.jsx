import { useState, useEffect } from "react";
import { getTradeHistory } from "../api";
import useStats from "../hooks/useStats";
import usePageTitle from "../hooks/usePageTitle";
import { LOADING, PORTFOLIO, APP_TITLE } from "../lib/copy";

import {
  BalanceCard,
  XpCard,
  EquityCurve,
  StatsGrid,
  InsightsRow,
  BadgesSection,
  TradeHistory,
} from "../components/portfolio/PortfolioWidgets";

const STARTING_BALANCE = 500_000;
const LEVEL_XP = 500;

export default function Portfolio() {
  const { stats } = useStats();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState({ key: "closed_at", dir: "desc" });

  usePageTitle(APP_TITLE.portfolio);

  useEffect(() => {
    let cancelled = false;
    getTradeHistory(200)
      .then((h) => { if (!cancelled) setHistory(h); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading || !stats) {
    return (
      <div className="loading" role="status" aria-live="polite">
        <span className="spinner" />
        {LOADING.portfolio}
      </div>
    );
  }

  const xp = stats.total_xp ?? 0;
  const xpLevel = Math.floor(xp / LEVEL_XP) + 1;
  const xpInLevel = xp % LEVEL_XP;
  const xpProgress = (xpInLevel / LEVEL_XP) * 100;
  const balance = stats.virtual_balance ?? STARTING_BALANCE;
  const totalPnl = stats.total_pnl ?? 0;
  const balancePct = ((balance - STARTING_BALANCE) / STARTING_BALANCE) * 100;
  const isProfit = balance >= STARTING_BALANCE;

  // Derived stats
  const avgWin = stats.avg_win ?? 0;
  const avgLoss = stats.avg_loss ?? 0;
  const profitFactor = avgLoss < 0 ? Math.abs(avgWin / avgLoss) : avgWin > 0 ? Infinity : 0;
  const rr = avgLoss < 0 ? (avgWin / Math.abs(avgLoss)).toFixed(2) : "—";

  return (
    <div className="page portfolio-page">
      <div className="page-header">
        <h1 className="page-title">{PORTFOLIO.pageTitle}</h1>
      </div>

      {/* Hero */}
      <div className="portfolio-hero">
        <BalanceCard
          balance={balance}
          totalPnl={totalPnl}
          balancePct={balancePct}
          isProfit={isProfit}
        />
        <XpCard xp={xp} xpLevel={xpLevel} xpInLevel={xpInLevel} xpProgress={xpProgress} />
      </div>

      {/* Equity curve */}
      <EquityCurve history={history} />

      {/* Stats grid */}
      <StatsGrid stats={stats} profitFactor={profitFactor} rr={rr} />

      {/* Quick insights */}
      <InsightsRow history={history} />

      {/* Badges */}
      <BadgesSection stats={stats} />

      {/* Trade history */}
      <TradeHistory
        history={history}
        filter={filter}
        setFilter={setFilter}
        sort={sort}
        setSort={setSort}
        onThesisUpdate={(id, thesis, xpAwarded) => {
          setHistory((prev) =>
            prev.map((t) =>
              t.id === id
                ? { ...t, thesis, xp_earned: (t.xp_earned || 0) + (xpAwarded || 0) }
                : t
            )
          );
        }}
      />
    </div>
  );
}


