import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { Zap, X, Edit3, Check } from "lucide-react";
import { toast } from "sonner";

import { closeTrade } from "../../api";
import { signedInr } from "../../lib/format";
import { invalidateStats } from "../../hooks/useStats";

/**
 * Positions bar — a fixed-height horizontal strip of cards.
 * Cards scroll horizontally so the bar never grows vertically,
 * no matter how many positions are open.
 */
export default function OpenPositions({ trades, onTradesChange, chain }) {
  const [adjustingId, setAdjustingId] = useState(null);
  const [adjustPrice, setAdjustPrice] = useState("");
  const [adjustReason, setAdjustReason] = useState("manual");
  const [exitingId, setExitingId] = useState(null);
  const prevLtpRef = useRef({});

  // Build live LTP map
  const ltpMap = useMemo(() => {
    if (!chain) return prevLtpRef.current;
    const map = {};
    if (Array.isArray(chain.strikes)) {
      for (const s of chain.strikes) {
        if (s.ce_ltp > 0) map[`NIFTY ${s.strike} CE`] = s.ce_ltp;
        if (s.pe_ltp > 0) map[`NIFTY ${s.strike} PE`] = s.pe_ltp;
      }
    } else if (Array.isArray(chain.data)) {
      for (const d of chain.data) {
        if (d.CE) map[`NIFTY ${d.strikePrice} CE`] = d.CE.lastPrice;
        if (d.PE) map[`NIFTY ${d.strikePrice} PE`] = d.PE.lastPrice;
      }
    } else {
      return prevLtpRef.current;
    }
    return map;
  }, [chain]);

  useEffect(() => {
    prevLtpRef.current = ltpMap;
  }, [ltpMap]);

  // Aggregate net P&L — depends on ltpMap which is now defined above
  const netPnl = useMemo(() => {
    let total = 0;
    let anyKnown = false;
    for (const trade of trades) {
      const ltp = ltpMap[trade.instrument];
      if (!ltp) continue;
      const dir = trade.direction === "BUY" ? 1 : -1;
      total += (ltp - trade.entry_price) * trade.quantity * dir;
      anyKnown = true;
    }
    return anyKnown ? total : null;
  }, [ltpMap, trades]);

  const getLtp = useCallback((trade) => ltpMap[trade.instrument] ?? null, [ltpMap]);

  const computePnL = useCallback(
    (trade) => {
      const ltp = getLtp(trade);
      if (ltp === null) return null;
      return (ltp - trade.entry_price) * trade.quantity * (trade.direction === "BUY" ? 1 : -1);
    },
    [getLtp]
  );

  const computeRoiPct = useCallback(
    (trade) => {
      const ltp = getLtp(trade);
      if (ltp === null || !trade.entry_price || trade.entry_price <= 0) return null;
      const dir = trade.direction === "BUY" ? 1 : -1;
      return (((ltp - trade.entry_price) * dir) / trade.entry_price) * 100;
    },
    [getLtp]
  );

  /** Where does the current LTP sit on the SL→Target scale (0–100%)? */
  const computeLtpBar = (trade) => {
    const ltp = getLtp(trade);
    const { stop_loss: sl, target: tgt } = trade;
    if (!ltp || !sl || !tgt || sl >= tgt) return null;
    const pct = ((ltp - sl) / (tgt - sl)) * 100;
    return Math.max(0, Math.min(100, pct));
  };

  const handleQuickExit = useCallback(
    async (trade) => {
      setExitingId(trade.id);
      try {
        const exitPrice = getLtp(trade) ?? trade.entry_price;
        const result = await closeTrade(trade.id, exitPrice, "market");
        toast.success(`Closed ${trade.instrument} · P&L ${signedInr(result.pnl)}`);
        invalidateStats();
        onTradesChange();
      } catch (err) {
        toast.error(err.response?.data?.detail || "Exit failed.");
      } finally {
        setExitingId(null);
      }
    },
    [getLtp, onTradesChange]
  );

  const handleStartAdjust = useCallback(
    (trade) => {
      setAdjustingId(trade.id);
      setAdjustPrice(String(getLtp(trade) ?? trade.entry_price));
      setAdjustReason("manual");
    },
    [getLtp]
  );

  const handleConfirmAdjust = useCallback(
    async (tradeId) => {
      const price = parseFloat(adjustPrice);
      if (!Number.isFinite(price) || price < 0) {
        toast.error("Enter a valid exit price.");
        return;
      }
      setExitingId(tradeId);
      try {
        const result = await closeTrade(tradeId, price, adjustReason);
        toast.success(`Closed · P&L ${signedInr(result.pnl)}`);
        setAdjustingId(null);
        invalidateStats();
        onTradesChange();
      } catch (err) {
        toast.error(err.response?.data?.detail || "Exit failed.");
      } finally {
        setExitingId(null);
      }
    },
    [adjustPrice, adjustReason, onTradesChange]
  );

  if (trades.length === 0) {
    return (
      <div className="pos-bar pos-bar-empty">
        <span className="pos-bar-empty-text">No open positions</span>
      </div>
    );
  }

  return (
    <div className="pos-bar">
      <div className="pos-bar-label">
        Positions <span className="pos-bar-count">{trades.length}</span>
        {netPnl !== null && (
          <span className={`pos-net-pnl ${netPnl >= 0 ? "bull" : "bear"}`}>
            {netPnl >= 0 ? "+" : ""}
            {netPnl.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
          </span>
        )}
      </div>

      <div className="pos-bar-scroll">
        {trades.map((trade) => {
          const ltp = getLtp(trade);
          const pnl = computePnL(trade);
          const roiPct = computeRoiPct(trade);
          const isProfit = pnl !== null && pnl >= 0;
          const isExiting = exitingId === trade.id;
          const isAdjusting = adjustingId === trade.id;
          const ltpPct = computeLtpBar(trade);
          const isBuy = trade.direction === "BUY";

          // Short instrument label: "NIFTY 23700 CE" → "23700 CE"
          const shortLabel = trade.instrument.replace(/^NIFTY\s+/, "");

          return (
            <div
              key={trade.id}
              className={`pos-card ${pnl !== null ? (isProfit ? "pos-card-profit" : "pos-card-loss") : ""}`}
            >
              {/* Top row: instrument + direction + exit button */}
              <div className="pos-card-top">
                <span className="pos-card-instrument">{shortLabel}</span>
                <span className={`pos-card-dir ${isBuy ? "buy" : "sell"}`}>
                  {isBuy ? "B" : "S"}
                </span>
                {!isAdjusting && (
                  <div className="pos-card-actions">
                    <button
                      className="pos-card-btn pos-card-adjust"
                      onClick={() => handleStartAdjust(trade)}
                      title="Adjust exit price"
                    >
                      <Edit3 size={11} />
                    </button>
                    <button
                      className={`pos-card-btn pos-card-exit ${isExiting ? "exiting" : ""}`}
                      onClick={() => handleQuickExit(trade)}
                      disabled={isExiting}
                      title="Quick exit at LTP"
                    >
                      <Zap size={11} />
                    </button>
                  </div>
                )}
              </div>

              {/* Adjust inline form */}
              {isAdjusting && (
                <div className="pos-card-adjust-form">
                  <input
                    type="number"
                    step="0.05"
                    className="pos-card-input"
                    value={adjustPrice}
                    onChange={(e) => setAdjustPrice(e.target.value)}
                    autoFocus
                  />
                  <select
                    className="pos-card-select"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                  >
                    <option value="manual">Manual</option>
                    <option value="target_hit">Target</option>
                    <option value="stop_hit">SL Hit</option>
                  </select>
                  <button
                    className="pos-card-btn pos-card-confirm"
                    onClick={() => handleConfirmAdjust(trade.id)}
                    disabled={isExiting}
                  >
                    <Check size={11} />
                  </button>
                  <button
                    className="pos-card-btn pos-card-cancel"
                    onClick={() => setAdjustingId(null)}
                  >
                    <X size={11} />
                  </button>
                </div>
              )}

              {/* Price row: entry → LTP */}
              <div className="pos-card-prices">
                <span className="pos-card-entry" title="Entry Price">₹{trade.entry_price.toFixed(1)}</span>
                <span className="pos-card-arrow">→</span>
                <span className={`pos-card-ltp ${ltp ? (isProfit ? "bull" : "bear") : "muted"}`} title="Current Price (LTP)">
                  {ltp ? `₹${ltp.toFixed(1)}` : "--"}
                </span>
              </div>

              {/* P&L & % Return (ROI) */}
              <div className="pos-card-pnl-row">
                <span className={`pos-card-pnl ${pnl !== null ? (isProfit ? "bull" : "bear") : "muted"}`}>
                  {pnl !== null ? signedInr(pnl) : "--"}
                </span>
                {roiPct !== null && (
                  <span className={`pos-card-roi ${roiPct >= 0 ? "bull" : "bear"}`}>
                    {roiPct >= 0 ? "+" : ""}{roiPct.toFixed(1)}%
                  </span>
                )}
              </div>

              {/* SL → LTP → Target progress track */}
              {ltpPct !== null && (
                <div className="pos-card-track-wrap">
                  <span className="pos-card-track-sl">SL</span>
                  <div className="pos-card-track">
                    <div
                      className={`pos-card-track-fill ${isProfit ? "fill-profit" : "fill-loss"}`}
                      style={{ width: `${ltpPct}%` }}
                    />
                    <div
                      className="pos-card-track-thumb"
                      style={{ left: `${ltpPct}%` }}
                      title={`LTP ₹${ltp?.toFixed(2)}`}
                    />
                  </div>
                  <span className="pos-card-track-tgt">TGT</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
