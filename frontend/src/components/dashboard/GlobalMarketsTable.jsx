import { HelpCircle, ArrowUp, ArrowDown, Minus, AlertCircle } from "lucide-react";
import {
  getMarketTooltip,
  getChangeTooltip,
  getContributionTooltip,
  getSignalTooltip,
} from "./TooltipHelpers";
import { pct, signed } from "../../lib/format";
import { DASHBOARD } from "../../lib/copy";

const InfoIcon = ({ content, label = "More info" }) => (
  <button
    type="button"
    aria-label={label}
    data-tooltip-id="global-tooltip"
    data-tooltip-content={content}
    style={{
      background: "transparent",
      border: "none",
      padding: 0,
      cursor: "help",
      marginLeft: 6,
      // Resting 0.7 keeps the icon subordinate to the column header while
      // clearing AA contrast against card / table backgrounds. 0.5 was too
      // dim once `--text-muted` was already a low-emphasis tone.
      opacity: 0.7,
      transition: "opacity 0.2s",
      display: "inline-flex",
      verticalAlign: "text-top",
      color: "inherit",
    }}
    onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
    onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.7)}
    onFocus={(e) => (e.currentTarget.style.opacity = 1)}
    onBlur={(e) => (e.currentTarget.style.opacity = 0.7)}
  >
    <HelpCircle size={13} />
  </button>
);

// Derive every visual concern (signal direction, arrow, change/contrib colors)
// in one place so the desktop table row and the mobile card row stay
// in lockstep — otherwise we'd have to keep two parallel ternary ladders.
function deriveRowMeta(item) {
  const sig =
    item.scoreContribution > 0.001
      ? "bull"
      : item.scoreContribution < -0.001
      ? "bear"
      : "flat";
  const Arrow =
    item.changePercent > 0 ? ArrowUp : item.changePercent < 0 ? ArrowDown : Minus;
  const changeColor =
    item.changePercent > 0
      ? "var(--green)"
      : item.changePercent < 0
      ? "var(--red)"
      : "var(--text-muted)";
  const contribColor =
    item.scoreContribution >= 0 ? "var(--green)" : "var(--red)";
  return { sig, Arrow, changeColor, contribColor };
}

export default function GlobalMarketsTable({ marketData, className }) {
  return (
    <div className={["card", className].filter(Boolean).join(" ")} style={{ padding: 0 }}>
      <div style={{ padding: "16px 16px 0" }}>
        <span className="card-title">{DASHBOARD.globalLabel}</span>
      </div>
      {/* Desktop / tablet: classic 5-column table. Hidden ≤600px in
          dashboard.css; mobile-card list (below) takes over. */}
      <table className="data-table markets-table-desktop" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>
              Market <InfoIcon content="Global asset or index being tracked." />
            </th>
            <th style={{ textAlign: "right" }}>
              Change <InfoIcon content="Recent percentage change (overnight or last 2 days)." />
            </th>
            <th style={{ textAlign: "right" }}>
              Weight <InfoIcon content="How heavily this asset moves the NIFTY bias score." />
            </th>
            <th style={{ textAlign: "right" }}>
              Contrib <InfoIcon content="Change × Weight. Positive pulls NIFTY up, negative drags down." />
            </th>
            <th>
              Signal <InfoIcon content="Isolated up / down / flat read for this asset." />
            </th>
          </tr>
        </thead>
        <tbody>
          {marketData.map((item) => {
            const unavailable = item.error === true || item.changePercent == null;

            if (unavailable) {
              return (
                <tr key={item.market} style={{ opacity: 0.5 }}>
                  <td
                    data-tooltip-id="global-tooltip"
                    data-tooltip-content={getMarketTooltip(item.market)}
                    tabIndex={0}
                    style={{ cursor: "help" }}
                  >
                    <span style={{ borderBottom: "1px dashed var(--text-muted)" }}>
                      {item.market}
                    </span>
                  </td>
                  <td
                    className="num"
                    colSpan={3}
                    data-tooltip-id="global-tooltip"
                    data-tooltip-content="Data unavailable — yfinance or NSE fetch failed. Will retry on next analysis run."
                    style={{ color: "var(--text-muted)", cursor: "help", textAlign: "right" }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                      <AlertCircle size={11} />
                      unavailable
                    </span>
                  </td>
                  <td>
                    <span className="signal-pill flat">— Flat</span>
                  </td>
                </tr>
              );
            }

            const { sig, Arrow, changeColor, contribColor } = deriveRowMeta(item);
            return (
              <tr key={item.market}>
                <td
                  data-tooltip-id="global-tooltip"
                  data-tooltip-content={getMarketTooltip(item.market)}
                  tabIndex={0}
                  style={{ cursor: "help" }}
                >
                  <span style={{ borderBottom: "1px dashed var(--text-muted)" }}>
                    {item.market}
                  </span>
                </td>
                <td
                  className="num"
                  style={{ color: changeColor, cursor: "help" }}
                  data-tooltip-id="global-tooltip"
                  data-tooltip-content={getChangeTooltip(item.market, item.changePercent)}
                  tabIndex={0}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                    <Arrow size={11} strokeWidth={2.5} />
                    {pct(item.changePercent, 2).replace("+", "")}
                  </span>
                </td>
                <td className="num">{item.weightAssigned}</td>
                <td
                  className="num"
                  data-tooltip-id="global-tooltip"
                  data-tooltip-content={getContributionTooltip(item.scoreContribution)}
                  tabIndex={0}
                  style={{ cursor: "help", color: contribColor, fontWeight: 600 }}
                >
                  {signed(item.scoreContribution, 4)}
                </td>
                <td
                  data-tooltip-id="global-tooltip"
                  data-tooltip-content={getSignalTooltip(sig)}
                  tabIndex={0}
                  style={{ cursor: "help" }}
                >
                  <span className={`signal-pill ${sig}`}>
                    {sig === "bull" ? "▲ Bull" : sig === "bear" ? "▼ Bear" : "— Flat"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Mobile: stacked card list. Shown ≤600px via dashboard.css. Each
          row mirrors the desktop table 1:1 in information density — name +
          change on the prominent top line; weight + contrib + signal pill
          on the secondary line. Tooltips are still wired so long-press on
          a touch device reveals the same context as desktop hover. */}
      <div className="markets-list-mobile">
        {marketData.map((item) => {
          const unavailable = item.error === true || item.changePercent == null;

          if (unavailable) {
            return (
              <div key={item.market} className="market-row unavailable">
                <div className="market-row-top">
                  <span
                    className="market-name"
                    data-tooltip-id="global-tooltip"
                    data-tooltip-content={getMarketTooltip(item.market)}
                  >
                    {item.market}
                  </span>
                  <span
                    className="market-change"
                    data-tooltip-id="global-tooltip"
                    data-tooltip-content="Data unavailable — yfinance or NSE fetch failed. Will retry on next analysis run."
                    style={{ color: "var(--text-muted)" }}
                  >
                    <AlertCircle size={11} />
                    unavailable
                  </span>
                </div>
                <div className="market-row-bot">
                  <span className="signal-pill flat">— Flat</span>
                </div>
              </div>
            );
          }

          const { sig, Arrow, changeColor, contribColor } = deriveRowMeta(item);
          return (
            <div key={item.market} className="market-row">
              <div className="market-row-top">
                <span
                  className="market-name"
                  data-tooltip-id="global-tooltip"
                  data-tooltip-content={getMarketTooltip(item.market)}
                >
                  {item.market}
                </span>
                <span
                  className="market-change"
                  style={{ color: changeColor }}
                  data-tooltip-id="global-tooltip"
                  data-tooltip-content={getChangeTooltip(item.market, item.changePercent)}
                >
                  <Arrow size={11} strokeWidth={2.5} />
                  {pct(item.changePercent, 2).replace("+", "")}
                </span>
              </div>
              <div className="market-row-bot">
                <span className="market-meta">
                  W{" "}
                  <span className="market-meta-val">{item.weightAssigned}</span>
                </span>
                <span
                  className="market-meta"
                  data-tooltip-id="global-tooltip"
                  data-tooltip-content={getContributionTooltip(item.scoreContribution)}
                >
                  Contrib{" "}
                  <span
                    className="market-meta-val"
                    style={{ color: contribColor, fontWeight: 600 }}
                  >
                    {signed(item.scoreContribution, 4)}
                  </span>
                </span>
                <span
                  className={`signal-pill ${sig}`}
                  data-tooltip-id="global-tooltip"
                  data-tooltip-content={getSignalTooltip(sig)}
                  style={{ marginLeft: "auto" }}
                >
                  {sig === "bull" ? "▲ Bull" : sig === "bear" ? "▼ Bear" : "— Flat"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
