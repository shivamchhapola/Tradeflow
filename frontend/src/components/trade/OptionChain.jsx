import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";

import ChainLeg from "./ChainLeg";

/**
 * PCR = Total PE OI / Total CE OI across all chain strikes.
 * > 1.2 = heavy put buying (bearish hedge / fear)
 * 0.8–1.2 = neutral
 * < 0.8 = call heavy (bullish expectation)
 */
function computePcr(allStrikes) {
  if (!allStrikes?.length) return null;
  let ce = 0, pe = 0;
  for (const s of allStrikes) {
    ce += s.ce_oi || 0;
    pe += s.pe_oi || 0;
  }
  return ce > 0 ? pe / ce : null;
}

/**
 * Option chain table — OI (bar) + IV + LTP columns per side.
 * - OI bar visualization (normalized to maxOi)
 * - IV column between OI and LTP
 * - Spot price divider pill between ATM strikes
 * - ITM shading (CE side below spot, PE side above spot)
 * - B/S buttons on hover
 */
export default function OptionChain({
  chain,
  error,
  loading,
  symbol,
  onSelectChart,
  onBuyClick,
  onSellClick,
  chartContract,
}) {
  const [filter, setFilter] = useState("atm");
  const scrollRef = useRef(null);

  const underlying = chain?.underlying || 0;

  const atmRef = useMemo(() => {
    if (underlying > 0) return underlying;
    if (!chain?.strikes?.length) return 0;
    const mid = Math.floor(chain.strikes.length / 2);
    return chain.strikes[mid].strike;
  }, [underlying, chain?.strikes]);

  const { strikes, spotDividerIdx } = useMemo(() => {
    if (!chain?.strikes?.length) return { strikes: [], spotDividerIdx: -1 };
    const ref = atmRef || 0;
    const source =
      filter === "atm" && ref > 0
        ? chain.strikes.filter((x) => Math.abs(x.strike - ref) <= 500)
        : chain.strikes;

    let dividerIdx = -1;
    if (ref > 0) {
      for (let i = 0; i < source.length - 1; i++) {
        if (source[i].strike <= ref && source[i + 1].strike > ref) {
          dividerIdx = i;
          break;
        }
      }
    }
    return { strikes: source, spotDividerIdx: dividerIdx };
  }, [chain, filter, atmRef]);

  // Compute the real maxOi across all visible strikes (both CE and PE)
  // used to normalize OI bar widths in ChainLeg
  const maxOi = useMemo(() => {
    if (!strikes.length) return 1;
    let max = 1;
    for (const s of strikes) {
      if (s.ce_oi > max) max = s.ce_oi;
      if (s.pe_oi > max) max = s.pe_oi;
    }
    return max;
  }, [strikes]);

  // PCR uses ALL chain strikes (not just visible near-ATM ones)
  const pcr = useMemo(() => computePcr(chain?.strikes), [chain?.strikes]);

  // Auto-scroll to ATM on first load and filter changes
  useEffect(() => {
    if (!chain?.strikes?.length || !scrollRef.current) return;
    const timer = setTimeout(() => {
      if (!scrollRef.current) return;
      const divider = scrollRef.current.querySelector(".chain-spot-line");
      if (divider) {
        const containerHeight = scrollRef.current.clientHeight;
        const dividerTop = divider.offsetTop;
        scrollRef.current.scrollTop = dividerTop - containerHeight / 2;
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [chain?.strikes?.length, filter]);

  if (loading) {
    return (
      <div className="loading trade-chain-state">
        <span className="spinner" />
        Fetching option chain...
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state trade-chain-state">
        <AlertCircle size={28} color="var(--text-muted)" />
        <h3>Option chain unavailable</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!chain) {
    return (
      <div className="empty-state trade-chain-state">
        <AlertCircle size={28} color="var(--text-muted)" />
        <h3>Option chain not loaded</h3>
        <p>Refresh to pull the nearest-expiry NIFTY chain.</p>
      </div>
    );
  }

  return (
    <div className="trade-chain">
      <div className="trade-chain-top">
        <div>
          <div className="trade-chain-price">
            {atmRef || underlying
              ? Number(atmRef || underlying).toLocaleString("en-IN", {
                  maximumFractionDigits: 2,
                })
              : "--"}
            <span>{symbol}</span>
          </div>
          <div className="trade-chain-expiry">Expiry: {chain.expiry}</div>
        </div>
        <div className="trade-chain-filters">
          {[
            ["atm", "Near ATM"],
            ["all", "All Strikes"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`chip ${filter === value ? "active" : ""}`}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
          {pcr !== null && (
            <span
              className={`chain-pcr-pill ${
                pcr > 1.2 ? "pcr-high" : pcr < 0.8 ? "pcr-low" : "pcr-mid"
              }`}
              title={`Put-Call Ratio (OI): ${pcr.toFixed(2)}. >1.2 = put-heavy (bearish hedge), <0.8 = call-heavy (bullish)`}
            >
              PCR {pcr.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* Column headers — 3 cols per side + strike center */}
      <div className="chain-head-row">
        {/* CE side: OI · IV · LTP */}
        <div className="chain-head-side chain-head-ce">
          <span>OI</span>
          <span>IV</span>
          <span>LTP</span>
        </div>
        <div className="chain-head-strike">STRIKE</div>
        {/* PE side: LTP · IV · OI */}
        <div className="chain-head-side chain-head-pe">
          <span>LTP</span>
          <span>IV</span>
          <span>OI</span>
        </div>
      </div>

      <div ref={scrollRef} className="chain-scroll">
        {strikes.map((s, idx) => {
          const isITM_CE = s.strike < (atmRef || underlying);
          const isITM_PE = s.strike > (atmRef || underlying);
          const isCeChart =
            chartContract?.strike === s.strike &&
            chartContract?.type === "CE" &&
            !chartContract?.isIndex;
          const isPeChart =
            chartContract?.strike === s.strike &&
            chartContract?.type === "PE" &&
            !chartContract?.isIndex;

          return (
            <div key={s.strike}>
              <div
                className={`chain-row ${isITM_CE ? "itm-ce" : ""} ${
                  isITM_PE ? "itm-pe" : ""
                }`}
              >
                <ChainLeg
                  side="ce"
                  strike={s}
                  maxOi={maxOi}
                  isChartActive={isCeChart}
                  onSelectChart={onSelectChart}
                  onBuyClick={onBuyClick}
                  onSellClick={onSellClick}
                />
                <div className="chain-strike-cell">
                  {s.strike.toLocaleString("en-IN")}
                </div>
                <ChainLeg
                  side="pe"
                  strike={s}
                  maxOi={maxOi}
                  isChartActive={isPeChart}
                  onSelectChart={onSelectChart}
                  onBuyClick={onBuyClick}
                  onSellClick={onSellClick}
                />
              </div>

              {idx === spotDividerIdx && (
                <div className="chain-spot-line">
                  <span className="chain-spot-value">
                    {Number(atmRef || underlying).toLocaleString("en-IN", {
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
