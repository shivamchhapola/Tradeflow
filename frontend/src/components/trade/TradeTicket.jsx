import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { num as fmtNum } from "../../lib/format";

const MAX_LOTS = 50;

const SL_PRESETS = [
  { label: "10%", pct: 0.1 },
  { label: "20%", pct: 0.2 },
  { label: "30%", pct: 0.3 },
];

const TGT_PRESETS = [
  { label: "25%", pct: 0.25 },
  { label: "50%", pct: 0.50 },
  { label: "75%", pct: 0.75 },
];

/** Direction-aware SL: BUY → below entry, SELL → above entry */
function defaultSl(entry, dir) {
  return dir === "BUY"
    ? (entry * 0.8).toFixed(2)   // 20% below
    : (entry * 1.2).toFixed(2);  // 20% above
}

/** Direction-aware target: BUY → above entry, SELL → below entry */
function defaultTgt(entry, dir) {
  return dir === "BUY"
    ? (entry * 1.25).toFixed(2)  // 25% above
    : (entry * 0.75).toFixed(2); // 25% below
}

/**
 * Trade ticket — now rendered as a right-side drawer panel, not a chart overlay.
 * Direction logic is fully correct for both BUY and SELL.
 */
export default function TradeTicket({
  selected,
  symbol,
  lotSize,
  onPlace,
  onClear,
  submitting,
}) {
  const [lots, setLots] = useState(1);
  const [direction, setDirection] = useState("BUY");
  const [entry, setEntry] = useState("");
  const [sl, setSl] = useState("");
  const [target, setTarget] = useState("");
  const [thesis, setThesis] = useState("");

  const ltp = selected
    ? selected.type === "CE"
      ? selected.ce_ltp
      : selected.pe_ltp
    : 0;

  // Reset fields whenever a new strike is selected
  useEffect(() => {
    if (!selected || !ltp || ltp <= 0) return;
    const dir = selected.initialDirection || "BUY";
    setDirection(dir);
    setEntry(ltp.toFixed(2));
    setSl(defaultSl(ltp, dir));
    setTarget(defaultTgt(ltp, dir));
    setLots(1);
    setThesis("");
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const quantity = (Number(lots) || 0) * lotSize;
  const entryN = parseFloat(entry);
  const slN = parseFloat(sl);
  const tgtN = parseFloat(target);
  const isBuy = direction === "BUY";
  const isCall = selected?.type === "CE";

  function changeLots(val) {
    setLots(Math.max(1, Math.min(MAX_LOTS, Number(val) || 1)));
  }

  function applySlPreset(pct) {
    if (!Number.isFinite(entryN) || entryN <= 0) return;
    setSl(isBuy
      ? (entryN * (1 - pct)).toFixed(2)  // below for BUY
      : (entryN * (1 + pct)).toFixed(2)  // above for SELL
    );
  }

  function applyTgtPreset(pct) {
    if (!Number.isFinite(entryN) || entryN <= 0) return;
    setTarget(isBuy
      ? (entryN * (1 + pct)).toFixed(2)  // above for BUY
      : (entryN * (1 - pct)).toFixed(2)  // below for SELL
    );
  }

  function resetToLtp() {
    if (!ltp || ltp <= 0) return;
    setEntry(ltp.toFixed(2));
    setSl(defaultSl(ltp, direction));
    setTarget(defaultTgt(ltp, direction));
  }

  function switchDirection(d) {
    setDirection(d);
    if (Number.isFinite(entryN) && entryN > 0) {
      setSl(defaultSl(entryN, d));
      setTarget(defaultTgt(entryN, d));
    }
  }

  // Direction-aware validation
  const valid = useMemo(() => {
    if (!Number.isFinite(entryN) || entryN <= 0) return false;
    if (!Number.isFinite(slN) || slN <= 0) return false;
    if (!Number.isFinite(tgtN) || tgtN <= 0) return false;
    return isBuy
      ? slN < entryN && tgtN > entryN
      : slN > entryN && tgtN < entryN;
  }, [entryN, slN, tgtN, isBuy]);

  const rr = useMemo(() => {
    if (!valid) return null;
    const risk = Math.abs(entryN - slN);
    const reward = Math.abs(tgtN - entryN);
    return risk > 0 ? reward / risk : null;
  }, [valid, entryN, slN, tgtN]);

  const maxLoss = valid && quantity > 0 ? Math.abs(entryN - slN) * quantity : null;
  const outlay = Number.isFinite(entryN) && quantity > 0 ? entryN * quantity : null;

  // Visual range bar: position of SL, entry, target on a 0–100 scale
  const rangeBar = useMemo(() => {
    if (!valid) return null;
    const lo = Math.min(slN, tgtN);
    const hi = Math.max(slN, tgtN);
    if (hi === lo) return null;
    const pct = (v) => ((v - lo) / (hi - lo)) * 100;
    return { slPct: pct(slN), entryPct: pct(entryN), tgtPct: pct(tgtN) };
  }, [valid, entryN, slN, tgtN]);

  function handleSubmit() {
    if (!selected || !valid) return;
    onPlace({
      instrument: `${symbol} ${selected.strike} ${selected.type}`,
      direction,
      quantity,
      entry_price: entryN,
      stop_loss: slN,
      target: tgtN,
      thesis: thesis.trim() || null,
    });
  }

  if (!selected) return null;

  const showDirectionHint =
    Number.isFinite(entryN) && Number.isFinite(slN) && Number.isFinite(tgtN) && !valid;

  return (
    <div className={`trade-ticket ${isCall ? "ticket-call" : "ticket-put"}`} aria-label="Order entry">
      {/* ── Header ── */}
      <div className="ticket-head">
        <div className="ticket-contract">
          <span className={`option-badge ${isCall ? "call" : "put"}`}>{selected.type}</span>
          <div>
            <strong>{symbol} {selected.strike.toLocaleString("en-IN")}</strong>
            <span className="ticket-ltp">LTP ₹{ltp.toFixed(2)}</span>
          </div>
        </div>
        <button type="button" className="ticket-close-btn" onClick={onClear} aria-label="Close ticket">
          <X size={16} />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="ticket-body">

        {/* Direction */}
        <div className="ticket-dir-row">
          {["BUY", "SELL"].map((d) => (
            <button
              key={d}
              type="button"
              className={`ticket-dir-btn ${direction === d ? `active ${d === "BUY" ? "buy" : "sell"}` : ""}`}
              onClick={() => switchDirection(d)}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Lots */}
        <div className="ticket-field">
          <label>Lots</label>
          <div className="ticket-stepper">
            <button type="button" onClick={() => changeLots((Number(lots) || 1) - 1)}>
              <Minus size={14} />
            </button>
            <input
              type="number"
              min="1"
              max={MAX_LOTS}
              step="1"
              value={lots}
              onChange={(e) => changeLots(e.target.value)}
            />
            <button type="button" onClick={() => changeLots((Number(lots) || 0) + 1)}>
              <Plus size={14} />
            </button>
          </div>
          <span className="ticket-hint">{fmtNum(quantity)} units · lot {lotSize}</span>
        </div>

        {/* Entry */}
        <div className="ticket-field">
          <div className="ticket-field-row">
            <label>Entry</label>
            <button type="button" className="ticket-link-btn" onClick={resetToLtp}>Use LTP</button>
          </div>
          <input type="number" step="0.05" value={entry} onChange={(e) => setEntry(e.target.value)} />
        </div>

        {/* Stop loss */}
        <div className="ticket-field">
          <div className="ticket-field-row">
            <label>
              Stop loss
              {!isBuy && <span className="ticket-dir-hint"> (above entry)</span>}
            </label>
            <div className="ticket-presets">
              {SL_PRESETS.map((p) => (
                <button key={p.label} type="button" className="ticket-preset" onClick={() => applySlPreset(p.pct)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <input type="number" step="0.05" value={sl} onChange={(e) => setSl(e.target.value)} />
        </div>

        {/* Target */}
        <div className="ticket-field">
          <div className="ticket-field-row">
            <label>
              Target
              {!isBuy && <span className="ticket-dir-hint"> (below entry)</span>}
            </label>
            <div className="ticket-presets">
              {TGT_PRESETS.map((p) => (
                <button key={p.label} type="button" className="ticket-preset" onClick={() => applyTgtPreset(p.pct)}>
                  +{Math.round(p.pct * 100)}%
                </button>
              ))}
            </div>
          </div>
          <input type="number" step="0.05" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>

        {/* Visual SL → Entry → Target range bar */}
        {rangeBar && (
          <div className="ticket-range">
            <div className="ticket-range-track">
              {isBuy ? (
                <>
                  <div className="t-range-risk"  style={{ left: `${rangeBar.slPct}%`,    width: `${rangeBar.entryPct - rangeBar.slPct}%` }} />
                  <div className="t-range-reward" style={{ left: `${rangeBar.entryPct}%`, width: `${rangeBar.tgtPct - rangeBar.entryPct}%` }} />
                </>
              ) : (
                <>
                  <div className="t-range-reward" style={{ left: `${rangeBar.tgtPct}%`,   width: `${rangeBar.entryPct - rangeBar.tgtPct}%` }} />
                  <div className="t-range-risk"   style={{ left: `${rangeBar.entryPct}%`, width: `${rangeBar.slPct - rangeBar.entryPct}%` }} />
                </>
              )}
              <div className="t-range-entry" style={{ left: `${rangeBar.entryPct}%` }} />
            </div>
            <div className="ticket-range-labels">
              <span className="bear">{isBuy ? `SL ₹${slN.toFixed(0)}` : `TGT ₹${tgtN.toFixed(0)}`}</span>
              <span className="muted">entry</span>
              <span className="bull">{isBuy ? `TGT ₹${tgtN.toFixed(0)}` : `SL ₹${slN.toFixed(0)}`}</span>
            </div>
          </div>
        )}

        {/* Direction validation hint */}
        {showDirectionHint && (
          <div className="ticket-warn">
            {isBuy ? "BUY: SL must be below entry, target above" : "SELL: SL must be above entry, target below"}
          </div>
        )}

        {/* Risk summary */}
        <div className="ticket-risk-card">
          {rr !== null && (
            <div className="ticket-risk-row">
              <span>Risk : Reward</span>
              <b className={rr >= 1.5 ? "bull" : rr >= 1 ? "warn" : "bear"}>1 : {rr.toFixed(1)}</b>
            </div>
          )}
          {maxLoss !== null && (
            <div className="ticket-risk-row">
              <span>Max loss</span>
              <b className="bear">₹{maxLoss.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</b>
            </div>
          )}
          {outlay !== null && (
            <div className="ticket-risk-row">
              <span>Premium outlay</span>
              <b>₹{outlay.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</b>
            </div>
          )}
        </div>
        {/* Optional thesis — always visible, never required */}
        <div className="ticket-field">
          <div className="ticket-field-row">
            <label>Thesis</label>
            <span style={{ fontSize: 10, color: "var(--xp)", fontWeight: 600 }}>+15 XP</span>
          </div>
          <textarea
            rows={3}
            placeholder="Why are you taking this trade? (optional)"
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
            style={{
              width: "100%",
              resize: "vertical",
              minHeight: 56,
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-primary)",
              fontFamily: "var(--font)",
              fontSize: 12,
              padding: "7px 10px",
              lineHeight: 1.5,
              outline: "none",
            }}
          />
        </div>

      </div>

      {/* ── Footer ── */}
      <div className="ticket-foot">
        <button
          type="button"
          className={`ticket-submit ${isBuy ? "buy" : "sell"}`}
          onClick={handleSubmit}
          disabled={submitting || !valid}
        >
          {submitting ? "Placing…" : `${isBuy ? "Buy" : "Sell"} ${fmtNum(quantity)} units`}
        </button>
      </div>
    </div>
  );
}
