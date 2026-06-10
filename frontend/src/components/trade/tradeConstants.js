export const LOT_SIZES = { NIFTY: 65 };

export const TOOLTIPS = {
  iv: "Implied Volatility: the market's expectation of future movement baked into the option price. Higher IV means more expensive options.",
  oi: "Open Interest: outstanding contracts at a strike. High CE OI can act as resistance; high PE OI can act as support.",
  ltp: "Last Traded Price: the most recent premium traded for this option.",
  rr: "Risk-to-reward ratio. A 1:2 means you risk Rs 1 to make Rs 2.",
};

/** Format NSE % change for chain cells; null/undefined → "--". */
export function formatSignedPct(value) {
  if (value == null || Number.isNaN(Number(value))) return "--";
  const n = Number(value);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function pctChangeClass(value) {
  if (value == null || Number.isNaN(Number(value)) || Number(value) === 0) return "muted";
  return Number(value) > 0 ? "bull" : "bear";
}
