import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  History,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Clock,
  Activity,
  Award,
  Zap,
} from "lucide-react";

import MentorReportDrawer from "../components/reports/MentorReportDrawer";

import { getTradeHistory, generateReport, getStats } from "../api";
import usePageTitle from "../hooks/usePageTitle";
import PnL from "../components/ui/PnL";
import { LOADING, ERRORS, SUCCESS, EMPTY, APP_TITLE } from "../lib/copy";
import { formatISTDate } from "../lib/time";



// --- Utilities ---

function calculateDuration(openStr, closeStr) {
  if (!openStr || !closeStr) return "—";
  const start = new Date(openStr);
  const end = new Date(closeStr);
  const diffMs = end - start;
  if (diffMs <= 0) return "< 1m";
  const mins = Math.floor(diffMs / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function calculateRR(entry, sl, target) {
  if (!entry || !sl || !target) return "—";
  const risk = Math.abs(entry - sl);
  const reward = Math.abs(target - entry);
  if (risk === 0) return "—";
  return `1:${(reward / risk).toFixed(1)}`;
}

function deriveProcessBadge(trade) {
  if (trade.process_verdict) {
    return trade.process_verdict; // from DB (LLM evaluated)
  }
  // Fallback: rule-based from cold data
  if (!trade.thesis || trade.thesis.trim() === "") return "NEEDS_WORK";
  if (trade.exit_reason === "stop_hit" || trade.exit_reason === "target_hit") {
    return "EXCELLENT"; // disciplined
  }
  return "GOOD"; // had thesis, manual exit
}

export default function Reports() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [generating, setGenerating] = useState(null);
  const [expandedCard, setExpandedCard] = useState(null);
  const [stats, setStats] = useState(null);

  // Filters & Sort
  const [filterMode, setFilterMode] = useState("ALL"); // ALL, REVIEWED, UNREVIEWED
  const [sortBy, setSortBy] = useState("DATE_DESC");

  const LIMIT = 50; // Fetched per chunk
  usePageTitle(APP_TITLE.reports);

  const loadMoreTrades = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await getTradeHistory(LIMIT, offset);
      if (data.length > 0) {
        setTrades((prev) => [...prev, ...data]);
        setOffset((prev) => prev + data.length);
      }
      if (data.length < LIMIT) {
        setHasMore(false);
      }
    } catch {
      toast.error(ERRORS.backendDown);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, offset]);

  // Initial Load
  useEffect(() => {
    let cancelled = false;

    getStats().then((s) => { if (!cancelled) setStats(s); }).catch(() => {});

    getTradeHistory(LIMIT, 0)
      .then((data) => {
        if (!cancelled) {
          setTrades(data);
          setHasMore(data.length === LIMIT);
          setOffset(data.length);
        }
      })
      .catch(() => toast.error(ERRORS.backendDown))
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  // Infinite Scroll
  useEffect(() => {
    if (loading || !hasMore) return undefined;
    const threshold = 100;

    function handleScroll() {
      const scrolledToBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - threshold;
      if (scrolledToBottom) loadMoreTrades();
    }
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loading, hasMore, loadMoreTrades]);

  async function handleGenerate(tradeId) {
    setGenerating(tradeId);
    try {
      const res = await generateReport(tradeId);
      setTrades((prev) =>
        prev.map((t) =>
          t.id === tradeId
            ? { ...t, report: res.report, thesis_score: res.thesis_score, process_verdict: res.process_verdict }
            : t
        )
      );
      setExpandedCard(tradeId);
      toast.success(SUCCESS.reportReady);
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(detail ? `Mentor review failed: ${detail}` : ERRORS.reportFailed);
    } finally {
      setGenerating(null);
    }
  }

  // --- Derived Data & Display logic ---

  const pendingReportsCount = trades.filter((t) => !t.report).length;
  
  const filteredAndSortedTrades = useMemo(() => {
    let result = [...trades];
    
    // Filter
    if (filterMode === "REVIEWED") result = result.filter(t => !!t.report);
    if (filterMode === "UNREVIEWED") result = result.filter(t => !t.report);

    // Sort
    result.sort((a, b) => {
      if (sortBy === "DATE_DESC") return new Date(b.closed_at) - new Date(a.closed_at);
      if (sortBy === "DATE_ASC") return new Date(a.closed_at) - new Date(b.closed_at);
      if (sortBy === "PNL_DESC") return (b.pnl || 0) - (a.pnl || 0);
      if (sortBy === "PNL_ASC") return (a.pnl || 0) - (b.pnl || 0);
      if (sortBy === "XP_DESC") return (b.xp_earned || 0) - (a.xp_earned || 0);
      return 0;
    });

    return result;
  }, [trades, filterMode, sortBy]);

  if (loading) {
    return (
      <div className="loading" role="status">
        <span className="spinner" />
        {LOADING.reports}
      </div>
    );
  }

  return (
    <div className="reports-container page">
      {/* --- DASHBOARD HEADER --- */}
      <div className="reports-hero">
        <div className="reports-hero-top">
          <div className="reports-hero-title">
            <h1>Trading Journal</h1>
            <p>Retrospective log of closed trades and mentor reviews.</p>
          </div>
        </div>

        <div className="reports-stat-strip">
          <div className="rstat">
            <span className="rstat-label"><History size={12}/> Total Trades</span>
            <span className="rstat-value">{stats?.total_trades || trades.length}</span>
          </div>
          <div className="rstat">
            <span className="rstat-label"><Target size={12}/> Win Rate</span>
            <span className={`rstat-value ${stats?.win_rate >= 50 ? 'green' : 'red'}`}>
              {stats?.win_rate || 0}%
            </span>
          </div>
          <div className="rstat">
            <span className="rstat-label"><Award size={12}/> Avg XP</span>
            <span className="rstat-value accent">
              {stats?.total_trades ? Math.round(stats.total_xp / stats.total_trades) : 0}
            </span>
          </div>
          <div className="rstat">
            <span className="rstat-label"><Zap size={12}/> Pending Reviews</span>
            <span className={`rstat-value ${pendingReportsCount > 0 ? 'amber' : ''}`}>
              {pendingReportsCount}
            </span>
          </div>
        </div>
      </div>

      {/* --- FILTER & SORT BAR --- */}
      <div className="reports-controls">
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${filterMode === "ALL" ? "active" : ""}`}
            onClick={() => setFilterMode("ALL")}
          >
            All Trades
          </button>
          <button 
            className={`filter-tab ${filterMode === "REVIEWED" ? "active" : ""}`}
            onClick={() => setFilterMode("REVIEWED")}
          >
            Reviewed
          </button>
          <button 
            className={`filter-tab ${filterMode === "UNREVIEWED" ? "active" : ""} ${filterMode === "UNREVIEWED" && pendingReportsCount > 0 ? "has-badge" : ""}`}
            onClick={() => setFilterMode("UNREVIEWED")}
          >
            Needs Review {pendingReportsCount > 0 && `(${pendingReportsCount})`}
          </button>
        </div>

        <select 
          className="sort-select" 
          value={sortBy} 
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="DATE_DESC">Latest First</option>
          <option value="DATE_ASC">Oldest First</option>
          <option value="PNL_DESC">Highest P&L</option>
          <option value="PNL_ASC">Lowest P&L</option>
          <option value="XP_DESC">Highest XP</option>
        </select>
      </div>

      {trades.length === 0 && (
        <div className="empty-state">
          <h3>{EMPTY.noReports.title}</h3>
          <p>{EMPTY.noReports.body}</p>
        </div>
      )}

      {/* --- TIMELINE --- */}
      <div className="journal-timeline">
        {filteredAndSortedTrades.map((t) => {
          const isExpanded = expandedCard === t.id;
          const isGenerating = generating === t.id;
          
          const isWin = t.pnl > 0;
          const isLoss = t.pnl < 0;
          const outcomeClass = isWin ? "win" : isLoss ? "loss" : "neutral";
          
          const processVerdict = deriveProcessBadge(t);
          const processClass = processVerdict === "EXCELLENT" ? "excellent" : processVerdict === "GOOD" ? "good" : "needs-work";
          const processLabel = processVerdict === "NEEDS_WORK" ? "Needs Work" : processVerdict === "EXCELLENT" ? "Excellent Process" : "Good Process";

          let exitReasonClass = "auto";
          let exitReasonLabel = "AUTO-SQUAREOFF";
          if (t.exit_reason === "target_hit") { exitReasonClass = "target-hit"; exitReasonLabel = "TARGET HIT"; }
          else if (t.exit_reason === "stop_hit") { exitReasonClass = "stop-hit"; exitReasonLabel = "STOP HIT"; }
          else if (t.exit_reason === "manual") { exitReasonClass = "manual"; exitReasonLabel = "MANUAL EXIT"; }

          return (
            <div key={t.id} className="journal-card-wrapper">
              <div className="timeline-dot">
                <div className={`timeline-dot-inner ${outcomeClass}`}>
                  {isWin ? <TrendingUp size={12} color="var(--green)" /> : 
                   isLoss ? <TrendingDown size={12} color="var(--red)" /> : 
                   <Minus size={12} color="var(--text-muted)" />}
                </div>
              </div>

              <div className={`journal-card ${outcomeClass}`}>
                
                {/* Header: Title, Process Badge, Date */}
                <div className="journal-card-header">
                  <div className="journal-card-header-left">
                    <div className="journal-card-title-row">
                      <span className="journal-instrument">{t.instrument}</span>
                      <span className={`process-badge ${processClass}`}>
                        <div className="process-badge-dot" />
                        {processLabel}
                      </span>
                    </div>
                    <div className="journal-meta-row">
                      <span className="journal-meta-item">
                        <Clock size={10}/> {t.closed_at ? formatISTDate(t.closed_at) : "—"}
                      </span>
                      <span className="trade-chip duration">
                        Dur: {calculateDuration(t.opened_at, t.closed_at)}
                      </span>
                      <span className={`trade-chip ${exitReasonClass}`}>
                        {exitReasonLabel}
                      </span>
                    </div>
                  </div>
                  <div className="journal-card-header-right">
                    <PnL value={t.pnl} size={18} showBg={true} />
                  </div>
                </div>

                {/* Metrics */}
                <div className="journal-metrics">
                  <div className="metric-item">
                    <span className="metric-label">Entry</span>
                    <span className="metric-value">₹{Number(t.entry_price || 0).toFixed(2)}</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-label">Exit</span>
                    <span className="metric-value">₹{Number(t.exit_price || 0).toFixed(2)}</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-label">Qty</span>
                    <span className="metric-value">{t.quantity}</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-label">Risk:Reward</span>
                    <span className="metric-value" style={{color: 'var(--blue)'}}>{calculateRR(t.entry_price, t.stop_loss, t.target)}</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-label">XP Earned</span>
                    <span className="metric-value" style={{color: 'var(--xp)'}}>+{t.xp_earned}</span>
                  </div>
                </div>

                {/* Thesis block */}
                <div className="thesis-card">
                  <div className="thesis-card-header">
                    <span className="thesis-card-label"><Activity size={10}/> Student Thesis</span>
                  </div>
                  <div className="thesis-text">
                    "{t.thesis || "No thesis provided before entry."}"
                  </div>
                  
                  {/* Thesis Alignment Bar (only shows if report generated, score exists, and thesis was provided) */}
                  {t.report && t.thesis_score != null && t.thesis && t.thesis.trim() !== "" && (
                    <div className="thesis-alignment" style={{marginTop: 8}}>
                      <div className="thesis-alignment-header">
                        <span className="thesis-alignment-label">Thesis vs Reality Alignment</span>
                        <span className={`thesis-alignment-score ${t.thesis_score >= 8 ? 'high' : t.thesis_score >= 5 ? 'mid' : 'low'}`}>
                          {t.thesis_score}/10
                        </span>
                      </div>
                      <div className="thesis-bar-track">
                        <div 
                          className={`thesis-bar-fill ${t.thesis_score >= 8 ? 'high' : t.thesis_score >= 5 ? 'mid' : 'low'}`} 
                          style={{ width: `${(t.thesis_score / 10) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions (Review Toggle) */}
                <div className="journal-card-actions">
                  <div className="journal-card-xp">
                    {/* Left side empty for future use or can hold extra meta */}
                  </div>
                  
                  {t.report ? (
                    <button
                      type="button"
                      className="mentor-toggle-btn"
                      onClick={() => setExpandedCard(isExpanded ? null : t.id)}
                    >
                      <Sparkles size={13} />
                      {isExpanded ? "Hide Review" : "View Review"}
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="get-review-btn"
                      onClick={() => handleGenerate(t.id)}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <>
                          <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                          Analyzing Process...
                        </>
                      ) : (
                        <>
                          <Sparkles size={13} />
                          Get Mentor Review
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Loading Skeleton */}
                {isGenerating && (
                  <div className="mentor-report-drawer">
                    <div className="mentor-report-header">
                      <Sparkles size={13} className="mentor-sparkle-icon" />
                      Mentor is reviewing trade...
                    </div>
                    <div className="shimmer-loader">
                      <div className="shimmer-bar w-full" />
                      <div className="shimmer-bar w-80" />
                      <div className="shimmer-bar w-60" />
                    </div>
                  </div>
                )}

                {/* Report Content */}
                {isExpanded && t.report && (
                  <MentorReportDrawer reportText={t.report} />
                )}

              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <div className="timeline-end-detector">
          {loadingMore ? (
            <><div className="timeline-spinner" /> Loading history...</>
          ) : (
            "Scroll down to load more..."
          )}
        </div>
      )}
      {!hasMore && trades.length > 0 && (
        <div className="timeline-end-detector" style={{opacity: 0.5}}>
          End of journal history.
        </div>
      )}
    </div>
  );
}
