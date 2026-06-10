/**
 * Tradeflow — number/currency/percent formatters.
 *
 * Single source for all numeric rendering so we get consistent
 * Indian grouping, signed values, and tabular layout everywhere.
 */

const inrFmt = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrFmt2 = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const numFmt = new Intl.NumberFormat("en-IN");

export function isNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}

/** ₹1,23,456 — whole rupees, en-IN grouping */
export function inr(value, fallback = "—") {
  const n = Number(value);
  if (!isNum(n)) return fallback;
  return inrFmt.format(n);
}

/** ₹1,23,456.45 — keeps paise precision */
export function inrPrecise(value, fallback = "—") {
  const n = Number(value);
  if (!isNum(n)) return fallback;
  return inrFmt2.format(n);
}

/**
 * Compact Indian formatting: ₹4.5L, ₹1.23Cr, ₹85K, ₹50.
 * Useful for hero stats and dashboards where digits compete with the layout.
 */
export function inrCompact(value, fallback = "—") {
  const n = Number(value);
  if (!isNum(n)) return fallback;
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(2)}Cr`;
  if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(2)}L`;
  if (a >= 1e3) return `${sign}₹${(a / 1e3).toFixed(1)}K`;
  return `${sign}₹${Math.round(a)}`;
}

/** "+12.4%" / "-3.1%" / "0.0%". */
export function pct(value, digits = 2, fallback = "—") {
  const n = Number(value);
  if (!isNum(n)) return fallback;
  const s = n > 0 ? "+" : "";
  return `${s}${n.toFixed(digits)}%`;
}

/** Signed plain number with fixed digits, "+" prefix when positive. */
export function signed(value, digits = 2, fallback = "—") {
  const n = Number(value);
  if (!isNum(n)) return fallback;
  const s = n > 0 ? "+" : "";
  return `${s}${n.toFixed(digits)}`;
}

/** Score formatting: -1.000 to +1.000 with 3 decimals. */
export function score(value, fallback = "—") {
  const n = Number(value);
  if (!isNum(n)) return fallback;
  return n.toFixed(3);
}

/** Signed P&L with rupee + sign. e.g. "+₹1,250" / "-₹325". */
export function signedInr(value, fallback = "—") {
  const n = Number(value);
  if (!isNum(n)) return fallback;
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}${inr(Math.abs(n))}`;
}

/** Plain en-IN grouped integer (no currency). */
export function num(value, fallback = "—") {
  const n = Number(value);
  if (!isNum(n)) return fallback;
  return numFmt.format(n);
}

/** Direction word ("up" / "down" / "flat") for color/icon picks. */
export function direction(value) {
  const n = Number(value);
  if (!isNum(n) || n === 0) return "flat";
  return n > 0 ? "up" : "down";
}

/**
 * Relative time string for a past ISO datetime.
 *
 * Examples: "Just now", "30s ago", "5m ago", "3h ago", "2d ago", "12 May".
 * Returns `fallback` when the input is missing or unparseable. Future times
 * are clamped to "Just now" — we don't have a use case for them yet and the
 * label would be misleading.
 */
export function relativeTime(iso, fallback = "—") {
  if (!iso) return fallback;
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return fallback;
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 10) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  // Beyond a week we fall back to a short absolute date — relative numbers
  // start losing meaning ("23d ago" is harder to parse than "12 May").
  const date = new Date(ts);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Absolute IST time formatter for tooltips: "08:12:34 IST · 17 May". */
export function absoluteIst(iso, fallback = "—") {
  if (!iso) return fallback;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;
  const time = date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
  const day = date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
  return `${time} IST · ${day}`;
}
