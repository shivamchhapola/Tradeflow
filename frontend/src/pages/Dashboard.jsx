import { useState, useMemo, useRef, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

import { getAnalysis, runAnalysis } from "../api";
import usePolling from "../hooks/usePolling";
import usePageTitle from "../hooks/usePageTitle";
import useAnimatedSize from "../hooks/useAnimatedSize";
import { scoreSignedClass, biasLabelClassFromBias } from "../lib/biasVisual";
import { relativeTime, absoluteIst } from "../lib/format";
import { ERRORS, DASHBOARD, APP_TITLE } from "../lib/copy";
import { marketPhase } from "../lib/time";

import ScoreCard from "../components/dashboard/ScoreCard";
import PlaybookCard from "../components/dashboard/PlaybookCard";
import MetricsCard from "../components/dashboard/MetricsCard";
import GlobalMarketsTable from "../components/dashboard/GlobalMarketsTable";
import QuestCard from "../components/dashboard/QuestCard";
import DashboardSkeleton from "../components/dashboard/DashboardSkeleton";

// 15s during live market hours, 60s otherwise (data is stale after hours).
const POLL_LIVE_MS = 15_000;
const POLL_IDLE_MS = 60_000;

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [, startTransition] = useTransition();

  usePageTitle(APP_TITLE.analysis);

  const pollInterval = marketPhase() === "live" ? POLL_LIVE_MS : POLL_IDLE_MS;

  // Visibility-aware poll: stops when the tab is hidden, resumes on return.
  usePolling(
    async () => {
      try {
        const result = await getAnalysis();
        startTransition(() => {
          setData(result);
          setError(null);
          setLoading(false);
        });
      } catch (err) {
        if (err?.response?.status === 404) {
          setError(ERRORS.analysisNoneYet);
        } else {
          setError(ERRORS.backendDown);
        }
        setLoading(false);
      }
    },
    pollInterval,
    true
  );

  async function handleRun() {
    // Guard against double-clicks while a refresh is already in flight —
    // hitting the backend twice would waste a request and spawn a second
    // toast.promise that races the first.
    if (refreshing) return;
    setError(null);
    setRefreshing(true);
    // `toast.promise` morphs a single toast in place: "Refreshing…" →
    // "Refreshed" / "Refresh failed". Cleaner than firing a separate toast
    // on each branch, and the in-flight toast is the canonical "we heard
    // your click" feedback for users who don't notice the icon spin.
    const promise = runAnalysis();
    toast.promise(promise, {
      loading: "Refreshing pre-market scan…",
      success: "Pre-market scan refreshed.",
      error: ERRORS.analysisFailed,
    });
    try {
      const result = await promise;
      startTransition(() => setData(result));
    } catch {
      setError(ERRORS.analysisFailed);
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    // Ghost layout that mirrors the real grid → no pop-in when data lands.
    return <DashboardSkeleton />;
  }

  if (error && !data) {
    return (
      <div>
        <div className="error-banner" role="alert">
          {error}
        </div>
        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleRun}
            disabled={refreshing}
          >
            {refreshing ? "Running…" : "Run analysis"}
          </button>
        </div>
      </div>
    );
  }

  return <DashboardContent data={data} error={error} onRun={handleRun} running={refreshing} />;
}

function DashboardContent({ data, error, onRun, running }) {
  const score = data?.final_bias_score ?? 0;
  const metrics = data?.metrics ?? {};
  const session = data?.session ?? {};
  const scoreClass = scoreSignedClass(score);
  const biasLabelClass = biasLabelClassFromBias(data?.market_bias, score);

  // Tick once per minute so "Updated 2m ago" stays current between fetches.
  // We only need minute-granularity in the header — relativeTime() rounds to
  // minutes once we're past 60s anyway, so faster ticks would just churn.
  const [, setNow] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNow((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const fetchedAt = data?.analysis_time;
  const fetchedRel = fetchedAt ? relativeTime(fetchedAt) : null;
  const fetchedAbs = fetchedAt ? absoluteIst(fetchedAt) : null;

  const leftRef = useRef(null);
  const rightRef = useRef(null);
  // MetricsCard is pinned to the left column intentionally — auto-placement
  // (`useShorterColumn` + `useFlipMove`) caused a visible staircase on load:
  // quest height grew, columns re-measured, card slid from right→left after
  // everything else had already settled. A fixed position avoids that and
  // is the layout the user prefers anyway.
  // Smoothly animate column heights for cases where children themselves
  // can't animate (rare — most growth is QuestCard, which animates itself).
  useAnimatedSize(leftRef);
  useAnimatedSize(rightRef);

  // Memoize sorted market data so we don't re-sort on every poll tick.
  const marketData = useMemo(
    () => [...(data?.market_data ?? [])].sort((a, b) => b.weightAssigned - a.weightAssigned),
    [data?.market_data]
  );

  return (
    <div className="page dashboard-container">
      <div className="page-header">
        <h1 className="page-title">
          {DASHBOARD.pageTitle}
        </h1>
        <div className="page-header-actions">
          {running ? (
            <span
              className="data-freshness is-refreshing"
              role="status"
              aria-live="polite"
            >
              Refreshing…
            </span>
          ) : (
            fetchedRel && (
            <span
              className="data-freshness"
              data-tooltip-id="global-tooltip"
              data-tooltip-content={`Last updated ${fetchedAbs}`}
              aria-label={`Data last updated ${fetchedRel}`}
            >
              Updated {fetchedRel}
            </span>
            )
          )}
          <button
            type="button"
            className="btn btn-icon"
            onClick={onRun}
            disabled={running}
            data-tooltip-id="global-tooltip"
            data-tooltip-content={running ? DASHBOARD.fetching : DASHBOARD.manualFetch}
            aria-label={DASHBOARD.manualFetch}
          >
            <RefreshCw size={15} className={running ? "spinning" : ""} />
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner" style={{ marginBottom: 16 }} role="alert">
          {error}
        </div>
      )}

      {/* Card priority — left column top→bottom, then right column top→bottom:
            Left  (primary read path):    Score → Playbook → Metrics
            Right (high-visibility):      Quest → Global Markets
         `metrics.warning` is no longer rendered as its own banner — it's
         folded into PlaybookCard as a sub-line so the same fact isn't
         restated in two cards stacked on top of each other. */}
      <div className="dashboard-grid">
        <div className="stack" ref={leftRef}>
          <ScoreCard
            score={score}
            metrics={metrics}
            scoreClass={scoreClass}
            biasLabelClass={biasLabelClass}
            marketBias={data?.market_bias}
          />

          <PlaybookCard data={data} score={score} metrics={metrics} />
          <MetricsCard metrics={metrics} />
        </div>

        <div className="stack" ref={rightRef}>
          <QuestCard score={score} metrics={metrics} sessionLabel={session.label} />
          <GlobalMarketsTable marketData={marketData} />
        </div>
      </div>
    </div>
  );
}
