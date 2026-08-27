import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  LineSeries,
  createChart,
} from "lightweight-charts";
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";

import { getOptionCandles, getNiftyChart } from "../../api";
import { marketPhase } from "../../lib/time";

const LIVE_REFRESH_MS = 15_000;  // 15s — matches NSE website's own refresh cadence

const RANGE_SECONDS = {
  "2h": 7200,
  "4h": 14400,
  day: 86400,
};

function formatPrice(value) {
  return Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function formatChange(value) {
  if (value == null) return null;
  const sign = value >= 0 ? "+" : "";
  return `${sign}${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function sma(candles, length) {
  return candles
    .map((candle, index) => {
      if (index + 1 < length) return null;
      const slice = candles.slice(index + 1 - length, index + 1);
      const value = slice.reduce((sum, item) => sum + item.close, 0) / length;
      return { time: candle.time, value };
    })
    .filter(Boolean);
}

/**
 * Compute approximate VWAP from candles.
 * NSE index chart doesn't include volume, so we use equal weighting
 * (typical price average) as a reasonable proxy.
 */
function vwap(candles) {
  let cumPrice = 0;
  return candles.map((c, i) => {
    const typicalPrice = (c.high + c.low + c.close) / 3;
    cumPrice += typicalPrice;
    return { time: c.time, value: cumPrice / (i + 1) };
  });
}

function applyVisibleRange(chart, candles, rangeKey) {
  if (!chart || !candles || !candles.length) return;
  if (rangeKey === "day") {
    chart.timeScale().fitContent();
    return;
  }

  const lastCandle = candles[candles.length - 1];
  const firstCandle = candles[0];
  if (!lastCandle || !firstCandle) return;

  const span = RANGE_SECONDS[rangeKey] ?? 7200;
  const toTime = lastCandle.time;
  const fromTime = Math.max(firstCandle.time, toTime - span);

  try {
    chart.timeScale().setVisibleRange({ from: fromTime, to: toTime });
  } catch {
    chart.timeScale().fitContent();
  }
}

export default function OptionPremiumChart({
  contract,
  onResetToIndex,
  refreshToken = 0,
  spotPrice = null,   // chain.underlying — shared source of truth for NIFTY spot
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const smaFastRef = useRef(null);
  const smaSlowRef = useRef(null);
  const vwapRef = useRef(null);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSma9, setShowSma9] = useState(true);
  const [showSma21, setShowSma21] = useState(true);
  const [showVwap, setShowVwap] = useState(false);
  const [visibleRange, setVisibleRange] = useState("2h");

  const title = contract?.isIndex
    ? "NIFTY 50 Index"
    : contract
    ? `${contract.symbol} ${contract.strike?.toLocaleString("en-IN")} ${
        contract.type
      }`
    : "Chart";

  const currentContractKey = contract?.isIndex
    ? "__index__"
    : (contract?.identifier ?? "__none__");

  const loadCandles = useCallback(
    async ({ silent = false } = {}) => {
      if (!contract) return;
      const isContractSwitch = currentContractKey !== prevContractKeyRef.current;

      if (!silent) setLoading(true);
      if (!silent) setError("");

      // Clear stale data ONLY when switching to a different contract/symbol.
      // Refreshes for the same contract keep existing candles visible so the
      // chart view never flashes, unmounts, or resets under the user.
      if (!silent && isContractSwitch) {
        setData(null);
      }

      try {
        let result;
        if (contract.isIndex) {
          result = await getNiftyChart();
          if (!result?.candles || result.candles.length === 0) {
            const now = new Date();
            const istHour = parseInt(
              now.toLocaleString("en-US", {
                timeZone: "Asia/Kolkata",
                hour: "numeric",
                hour12: false,
              }),
              10
            );
            const istMinute = parseInt(
              now.toLocaleString("en-US", {
                timeZone: "Asia/Kolkata",
                minute: "numeric",
              }),
              10
            );
            const istTime = istHour + istMinute / 60;
            const isWeekend = now.getDay() === 0 || now.getDay() === 6;
            const isMarketHours =
              !isWeekend && istTime >= 9.25 && istTime < 15.5;
            if (!isMarketHours) {
              setError("market_closed");
            } else {
              setError("No candle data yet. Try refreshing in a moment.");
            }
            if (!silent) setLoading(false);
            return;
          }
        } else {
          if (!contract.identifier) {
            setError("Select a valid contract strike to view premium chart.");
            if (!silent) setLoading(false);
            return;
          }
          result = await getOptionCandles(contract.identifier, 300);
          if (!result?.candles || result.candles.length === 0) {
            setError("No premium data for this strike. Try another.");
            if (!silent) setLoading(false);
            return;
          }
        }
        setData(result);
        setError("");
      } catch (err) {
        if (!silent) setError(err.response?.data?.detail || "Chart fetch failed.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [contract, currentContractKey]
  );

  useEffect(() => {
    loadCandles();
  }, [loadCandles, refreshToken]);

  useEffect(() => {
    if (marketPhase(new Date()) !== "live") return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadCandles({ silent: true });
      }
    }, LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [loadCandles]);

  const candles = useMemo(() => data?.candles || [], [data]);

  // Compute daily change for the index chart header
  const dailyChange = useMemo(() => {
    if (!candles.length) return null;
    const first = candles[0].open;
    const last = candles[candles.length - 1].close;
    return { abs: last - first, pct: ((last - first) / first) * 100 };
  }, [candles]);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#0a0a0d" },
        textColor: "#909099",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.035)" },
        horzLines: { color: "rgba(255,255,255,0.035)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
        textColor: "#808088",
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
        minBarSpacing: 4,
        maxBarSpacing: 40,
        rightOffset: 5,
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: "rgba(255,255,255,0.12)",
          width: 1,
          style: 3,
        },
        horzLine: {
          color: "rgba(255,255,255,0.12)",
          width: 1,
          style: 3,
        },
      },
    });

    chartRef.current = chart;
    chart.priceScale("right").applyOptions({
      scaleMargins: { top: 0.08, bottom: 0.08 },
    });

    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    smaFastRef.current = chart.addSeries(LineSeries, {
      color: "#2dd4bf",
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    smaSlowRef.current = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    vwapRef.current = chart.addSeries(LineSeries, {
      color: "#a78bfa",
      lineWidth: 1.5,
      lineStyle: 1, // dashed
      priceLineVisible: false,
      lastValueVisible: false,
    });

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      smaFastRef.current = null;
      smaSlowRef.current = null;
      vwapRef.current = null;
    };
  }, []);

  const prevCandlesRef = useRef([]);
  const prevContractKeyRef = useRef(null);

  // Effect 1 — contract switch detector.
  // Resets prevCandlesRef so the next candle paint always does a full setData + range fit.
  useEffect(() => {
    if (currentContractKey !== prevContractKeyRef.current) {
      prevCandlesRef.current = [];
      prevContractKeyRef.current = currentContractKey;
    }
  }, [currentContractKey]);

  // Effect 2 — candle painter.
  // Updates candle series in-place without resetting scale/viewport during data refreshes.
  useEffect(() => {
    if (!candles.length || !candleSeriesRef.current) return;

    const prev = prevCandlesRef.current;
    const isInitialLoad = prev.length === 0;

    if (isInitialLoad) {
      // Contract initial load: set data, auto-scale price axis, apply initial visible range.
      candleSeriesRef.current.setData(candles);
      smaFastRef.current?.setData(showSma9 ? sma(candles, 9) : []);
      smaSlowRef.current?.setData(showSma21 ? sma(candles, 21) : []);
      vwapRef.current?.setData(showVwap ? vwap(candles) : []);

      chartRef.current?.priceScale("right").applyOptions({ autoScale: true });

      setTimeout(() => {
        if (chartRef.current) applyVisibleRange(chartRef.current, candles, visibleRange);
      }, 50);
    } else {
      // Seamless in-place update for data refreshes (same contract):
      // Preserves existing chart zoom/pan position.
      candleSeriesRef.current.setData(candles);
      smaFastRef.current?.setData(showSma9 ? sma(candles, 9) : []);
      smaSlowRef.current?.setData(showSma21 ? sma(candles, 21) : []);
      vwapRef.current?.setData(showVwap ? vwap(candles) : []);
    }

    prevCandlesRef.current = candles;
  }, [candles, showSma9, showSma21, showVwap]);

  // Effect 3 — explicit range chip change handler (1h, 2h, 4h, day).
  const prevVisibleRangeRef = useRef(visibleRange);
  useEffect(() => {
    if (prevVisibleRangeRef.current !== visibleRange) {
      prevVisibleRangeRef.current = visibleRange;
      if (chartRef.current && candles.length) {
        applyVisibleRange(chartRef.current, candles, visibleRange);
      }
    }
  }, [visibleRange, candles]);

  const intervalLabel = contract?.isIndex ? data?.interval || "5m" : "5m";
  const isMarketClosed = error === "market_closed";

  const handleRangeClick = (key) => {
    setVisibleRange(key);
    if (chartRef.current && candles.length) {
      applyVisibleRange(chartRef.current, candles, key);
    }
  };

  return (
    <div className="trade-chart">
      <div className="trade-chart-header">
        <div>
          <div className="trade-chart-title-row">
            <div className="trade-chart-title">{title}</div>
            {!contract?.isIndex && onResetToIndex && (
              <button
                type="button"
                className="btn btn-ghost btn-xs chart-back-btn"
                onClick={onResetToIndex}
              >
                <ArrowLeft size={11} style={{ marginRight: 2 }} />
                NIFTY 50
              </button>
            )}
          </div>
          <div className="trade-chart-subtitle">
            {data?.source || "NSE"} · {intervalLabel}
            {contract?.isIndex
              ? " · spot from option chain (same refresh)"
              : " premium"}
          </div>
        </div>

        <div className="trade-chart-actions">
          {/* For index chart: prefer spotPrice from chain (same source as chain panel)
              For option chart: show last candle close */}
          {contract?.isIndex && spotPrice != null && (
            <div className="chart-price-block">
              <span className="trade-chart-last">{formatPrice(spotPrice)}</span>
              {dailyChange != null && (
                <span className={`chart-daily-change ${dailyChange.abs >= 0 ? "bull" : "bear"}`}>
                  {formatChange(dailyChange.abs)} ({formatChange(dailyChange.pct)}%)
                </span>
              )}
            </div>
          )}
          {!contract?.isIndex && data?.last != null && (
            <div className="chart-price-block">
              <span className="trade-chart-last">{formatPrice(data.last)}</span>
            </div>
          )}
          <button
            type="button"
            className="btn btn-icon btn-sm"
            onClick={() => loadCandles()}
            disabled={loading || !contract}
            aria-label="Refresh chart"
          >
            <RefreshCw size={13} className={loading ? "spinning" : ""} />
          </button>
        </div>
      </div>

      <div className="chart-settings-bar">
        <span className="chart-settings-label">Range</span>
        {Object.keys(RANGE_SECONDS).map((key) => (
          <button
            key={key}
            type="button"
            className={`chip chart-range-chip ${
              visibleRange === key ? "active" : ""
            }`}
            onClick={() => handleRangeClick(key)}
          >
            {key.toUpperCase()}
          </button>
        ))}
        <span className="chart-settings-divider" />
        <label className="chart-toggle">
          <input
            type="checkbox"
            checked={showSma9}
            onChange={(e) => setShowSma9(e.target.checked)}
          />
          <span className="chart-toggle-dot sma9" />
          SMA 9
        </label>
        <label className="chart-toggle">
          <input
            type="checkbox"
            checked={showSma21}
            onChange={(e) => setShowSma21(e.target.checked)}
          />
          <span className="chart-toggle-dot sma21" />
          SMA 21
        </label>
        <label className="chart-toggle">
          <input
            type="checkbox"
            checked={showVwap}
            onChange={(e) => setShowVwap(e.target.checked)}
          />
          <span className="chart-toggle-dot vwap" />
          VWAP
        </label>
      </div>

      <div className="trade-chart-body">
        <div ref={containerRef} className="lightweight-chart" />
        {!contract && (
          <div className="trade-chart-overlay empty-state">
            <AlertCircle size={28} color="var(--text-muted)" />
            <h3>Select a chart</h3>
            <p>Pick a NIFTY CE or PE from the chain, or view the NIFTY 50 index.</p>
          </div>
        )}
        {contract && loading && !candles.length && (
          <div className="trade-chart-overlay loading">
            <span className="spinner" />
            Fetching candles...
          </div>
        )}
        {contract && isMarketClosed && (
          <div className="trade-chart-overlay chart-closed-state">
            <div className="chart-closed-icon">🕐</div>
            <div className="chart-closed-title">Markets closed</div>
            <div className="chart-closed-desc">
              NSE session ends at 3:30 PM IST.<br />
              Candle data available during trading hours only.
            </div>
            <div className="chart-closed-time">9:15 AM – 3:30 PM IST · Mon–Fri</div>
          </div>
        )}
        {contract && error && !isMarketClosed && (
          <div className="trade-chart-overlay empty-state">
            <AlertCircle size={28} color="var(--text-muted)" />
            <h3>Chart unavailable</h3>
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
