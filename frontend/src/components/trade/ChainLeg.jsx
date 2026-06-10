import { formatSignedPct, pctChangeClass } from "./tradeConstants";

/**
 * Option chain leg — OI (with bar) + IV + LTP columns.
 * Layout per side:
 *   CE: [OI bar cell] [IV cell] [LTP + B/S cell]
 *   PE: [LTP + B/S cell] [IV cell] [OI bar cell]
 */
export default function ChainLeg({
  side,
  strike,
  maxOi,
  isChartActive,
  onSelectChart,
  onBuyClick,
  onSellClick,
}) {
  const isCe = side === "ce";
  const type = isCe ? "CE" : "PE";
  const sideClass = isCe ? "chain-side-ce" : "chain-side-pe";
  const ltp = isCe ? strike.ce_ltp : strike.pe_ltp;
  const ltpChg = isCe ? strike.ce_ltp_chg_pct : strike.pe_ltp_chg_pct;
  const oi = isCe ? strike.ce_oi : strike.pe_oi;
  const oiChg = isCe ? strike.ce_oi_chg_pct : strike.pe_oi_chg_pct;
  const iv = isCe ? strike.ce_iv : strike.pe_iv;
  const hasLtp = ltp > 0;

  // OI bar width as a percentage of maxOi
  const oiBarPct = maxOi > 0 && oi > 0 ? Math.min((oi / maxOi) * 100, 100) : 0;

  function handleBuy(e) {
    e.stopPropagation();
    onBuyClick(strike, type);
  }

  function handleSell(e) {
    e.stopPropagation();
    onSellClick(strike, type);
  }

  function handleLegClick() {
    onSelectChart(strike, type);
  }

  const fmtOi = (val) => {
    if (!val) return "--";
    if (val >= 10000000) return `${(val / 10000000).toFixed(1)}Cr`;
    if (val >= 100000) return `${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
    return String(val);
  };

  const fmtIv = (val) => {
    if (val == null || val <= 0) return "--";
    return `${Number(val).toFixed(1)}%`;
  };

  const oiCell = (
    <div
      className={`chain-cell chain-cell-oi ${sideClass} ${isChartActive ? "leg-active" : ""}`}
      onClick={handleLegClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") handleLegClick(); }}
    >
      {/* OI bar background */}
      <div
        className={`chain-oi-bar-bg ${isCe ? "ce" : "pe"}`}
        style={{ width: `${oiBarPct}%` }}
        aria-hidden
      />
      <span className="chain-val chain-oi-val">{fmtOi(oi)}</span>
      <span className={`chain-sub ${pctChangeClass(oiChg)}`}>{formatSignedPct(oiChg)}</span>
    </div>
  );

  const ivCell = (
    <div
      className={`chain-cell chain-cell-iv ${sideClass} ${isChartActive ? "leg-active" : ""}`}
      onClick={handleLegClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") handleLegClick(); }}
    >
      <span className="chain-val chain-iv-val">{fmtIv(iv)}</span>
      <span className="chain-sub chain-iv-label">IV</span>
    </div>
  );

  const ltpCell = (
    <div
      className={`chain-cell chain-cell-ltp ${sideClass} ${isChartActive ? "leg-active" : ""}`}
      onClick={handleLegClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") handleLegClick(); }}
    >
      <div className="chain-ltp-row">
        <div className="chain-ltp-data">
          <span className="chain-val">{hasLtp ? ltp.toFixed(2) : "--"}</span>
          <span className={`chain-sub ${pctChangeClass(ltpChg)}`}>{formatSignedPct(ltpChg)}</span>
        </div>
        {hasLtp && (
          <div className="chain-actions">
            <button type="button" className="btn-action-b" onClick={handleBuy} title={`Buy ${type}`}>B</button>
            <button type="button" className="btn-action-s" onClick={handleSell} title={`Sell ${type}`}>S</button>
          </div>
        )}
      </div>
    </div>
  );

  if (isCe) {
    return (
      <>
        {oiCell}
        {ivCell}
        {ltpCell}
      </>
    );
  }

  return (
    <>
      {ltpCell}
      {ivCell}
      {oiCell}
    </>
  );
}
