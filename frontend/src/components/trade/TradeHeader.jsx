import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { absoluteIst } from "../../lib/format";
import { marketPhase } from "../../lib/time";

/**
 * Returns seconds since the ISO date string, or null if missing.
 */
function secondsSince(isoString) {
  if (!isoString) return null;
  return (Date.now() - new Date(isoString).getTime()) / 1000;
}

export default function TradeHeader({
  chain,
  chainLoading,
  chainFetchedAt,
  showChart,
  onToggleChart,
  onRefresh,
}) {
  const isLive = marketPhase(new Date()) === "live";

  // Tick every 5s so the freshness dot updates without a page reload
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const age = secondsSince(chainFetchedAt);
  const freshness = age === null ? "unknown"
    : age < 20 ? "fresh"
    : age < 60 ? "recent"
    : "stale";

  const ageLabel = age === null ? null
    : age < 20 ? "Live"
    : age < 60 ? `${Math.round(age)}s ago`
    : age < 3600 ? `${Math.round(age / 60)}m ago`
    : "stale";

  return (
    <div className="trade-topbar">
      <div className="trade-symbol-tabs">
        <button type="button" className="active">NIFTY</button>
      </div>

      {chain?.underlying > 0 && (
        <div className="trade-spot">
          <strong>{Number(chain.underlying).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
          <span>spot</span>
        </div>
      )}

      {chain?.expiry && <span className="trade-expiry">{chain.expiry}</span>}

      {/* Live / closed pill */}
      <span className={`trade-data-pill ${isLive ? "live" : "delayed"}`}>
        {isLive ? "Live session" : "Markets closed"}
      </span>

      {/* Freshness indicator — pulsing dot replaces stale "Xm ago" text */}
      {chainFetchedAt && (
        <span
          className="trade-freshness-wrap"
          data-tooltip-id="global-tooltip"
          data-tooltip-content={
            chain?.timestamp
              ? `NSE snapshot: ${chain.timestamp} · Fetched: ${absoluteIst(chainFetchedAt)}`
              : `Fetched: ${absoluteIst(chainFetchedAt)}`
          }
        >
          <span className={`trade-freshness-dot ${freshness}`} />
          <span className="trade-freshness-label">
            {chain?.timestamp
              ? `Data: ${chain.timestamp}`
              : ageLabel}
          </span>
        </span>
      )}

      <div className="trade-topbar-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onToggleChart}>
          {showChart ? "Hide chart" : "Show chart"}
        </button>
        <button
          type="button"
          className="btn btn-icon btn-sm"
          onClick={onRefresh}
          disabled={chainLoading}
          aria-label="Refresh chart and option chain"
          data-tooltip-id="global-tooltip"
          data-tooltip-content="Refresh chain and chart (auto-refreshes every 15s during market hours)"
        >
          <RefreshCw size={13} className={chainLoading ? "spinning" : ""} />
        </button>
      </div>
    </div>
  );
}
