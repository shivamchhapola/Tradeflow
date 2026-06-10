/**
 * Tradeflow — IST time helpers.
 *
 * Per AGENTS.md: never do manual UTC+5:30 math.
 * Always rely on Intl with timeZone: "Asia/Kolkata" so output is
 * correct regardless of the user's local clock.
 */

const IST = "Asia/Kolkata";

/** Native Date instance — JS dates are timezone-agnostic; treat output via formatters. */
export function now() {
  return new Date();
}

/**
 * Format an ISO string / Date as IST date+time.
 * Naive ISO timestamps (no tz suffix) coming from the backend are
 * already IST wall-clock — append +05:30 so JS doesn't apply the user's local tz.
 */
function coerceDate(input) {
  if (!input) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  let s = String(input).trim();
  if (s.includes("T") && !/[zZ]$/.test(s) && !/[+-]\d{2}:?\d{2}$/.test(s)) {
    const base = s.length >= 19 ? s.slice(0, 19) : s;
    s = `${base}+05:30`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "11 May 2026" (en-IN, IST). */
export function formatISTDate(input, fallback = "—") {
  const d = coerceDate(input);
  if (!d) return fallback;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: IST,
  });
}

/** "11 May" (no year — for dense tables / chart axes). */
export function formatISTDateShort(input, fallback = "—") {
  const d = coerceDate(input);
  if (!d) return fallback;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: IST,
  });
}

/** "9:45 AM" (12-hour, IST). */
export function formatISTTime(input, fallback = "—") {
  const d = coerceDate(input);
  if (!d) return fallback;
  return d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: IST,
  });
}

/** "11 May, 9:45 AM" — for trade history rows. */
export function formatISTDateTime(input, fallback = "—") {
  const d = coerceDate(input);
  if (!d) return fallback;
  const date = d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: IST,
  });
  const time = d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: IST,
  });
  return `${date}, ${time}`;
}

/**
 * Returns IST hour+minute as { h, m } regardless of user's timezone.
 * Uses Intl with timeZone:"Asia/Kolkata" — never raw UTC math.
 */
export function istClockParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: IST,
  })
    .formatToParts(date)
    .reduce((acc, p) => {
      if (p.type === "hour" || p.type === "minute") acc[p.type] = parseInt(p.value, 10);
      return acc;
    }, {});
  return { h: parts.hour ?? 0, m: parts.minute ?? 0 };
}

/** "14:32" — IST 24-hour clock. */
export function istClock(date = new Date()) {
  const { h, m } = istClockParts(date);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Day-of-week number in IST (0 Sun … 6 Sat). */
export function istWeekday(date = new Date()) {
  const wd = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: IST,
  }).format(date);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? 0;
}

/**
 * Market phase derived from IST clock + weekday.
 * NSE hours: 9:15 AM – 3:30 PM, weekdays only.
 * Returns one of:
 *   "weekend"      — Sat/Sun
 *   "premarket"    — 0:00–9:14 IST on a weekday
 *   "live"         — 9:15–15:29 IST on a weekday
 *   "closing"      — 15:30 IST exact
 *   "after-hours"  — 15:30+ on a weekday
 */
export function marketPhase(date = new Date()) {
  const wd = istWeekday(date);
  if (wd === 0 || wd === 6) return "weekend";
  const { h, m } = istClockParts(date);
  const mins = h * 60 + m;
  if (mins < 9 * 60 + 15) return "premarket";
  if (mins < 15 * 60 + 30) return "live";
  return "after-hours";
}

/**
 * Minutes until market open (9:15 IST). Negative once the market is open.
 * `null` on weekends.
 */
export function minsToMarketOpen(date = new Date()) {
  const wd = istWeekday(date);
  if (wd === 0 || wd === 6) return null;
  const { h, m } = istClockParts(date);
  const open = 9 * 60 + 15;
  return open - (h * 60 + m);
}
