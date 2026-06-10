/**
 * Tradeflow — Quest phase clock helpers.
 *
 * Mirrors the server-side `engine.quest_phases` boundaries so the UI can show
 * a subtle "ends in 1h 23m" countdown next to the active phase pill.
 *
 * Phase boundaries (IST):
 *   early       → 9:00
 *   premarket   → 9:15
 *   intraday    → 15:30
 *   postmarket  → tomorrow 00:00 (then natural phase changes via weekday)
 *   weekend     → next Monday 09:00 IST
 *
 * `pending_reports` / `quiz_backlog` are display nudges and inherit the
 * underlying natural phase's boundary.
 */

import { istClockParts, istWeekday } from "./time";

const NATURAL_PHASES = new Set([
  "early",
  "premarket",
  "intraday",
  "postmarket",
  "weekend",
]);

/**
 * Compute the natural phase for `now` (IST). Mirrors server logic in
 * `backend/engine/quest_phases.py::compute_natural_phase`.
 */
export function computeNaturalPhase(now = new Date()) {
  const wd = istWeekday(now);
  if (wd === 0 || wd === 6) return "weekend";
  const { h, m } = istClockParts(now);
  const mins = h * 60 + m;
  if (mins < 9 * 60) return "early";
  if (mins < 9 * 60 + 15) return "premarket";
  if (mins < 15 * 60 + 30) return "intraday";
  return "postmarket";
}

/**
 * Return ms until the given phase ends (relative to `now`).
 * `null` for unknown / nudge phases that don't have a meaningful boundary.
 */
export function msToPhaseEnd(phase, now = new Date()) {
  const target = nextPhaseBoundaryMs(phase, now);
  if (target == null) return null;
  return target - now.getTime();
}

/**
 * Epoch ms of the moment the given phase ends.
 *
 * The challenge: the user's local clock might be anything. Since we don't
 * have native IST Date construction, we walk forward in 1-minute steps until
 * the natural phase changes. That's at most ~450 iterations for an intraday
 * phase and ~2880 for a postmarket→tomorrow boundary; trivially cheap.
 */
function nextPhaseBoundaryMs(phase, now) {
  if (!NATURAL_PHASES.has(phase)) return null;

  // Cap the walk — protects against any weird tz misread that would otherwise
  // loop forever. 3 days covers the longest realistic boundary (weekend).
  const MAX_MINUTES = 60 * 24 * 4;
  const startMs = now.getTime();
  for (let i = 1; i <= MAX_MINUTES; i++) {
    const future = new Date(startMs + i * 60_000);
    if (computeNaturalPhase(future) !== phase) {
      return future.getTime();
    }
  }
  return null;
}

/** Humanise a positive millisecond duration: "45s", "23m", "1h 23m", "2d 4h". */
export function formatCountdown(ms) {
  if (ms == null || ms <= 0) return "ending";
  const totalSec = Math.floor(ms / 1000);
  const days  = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const mins  = Math.floor((totalSec % 3600) / 60);
  const secs  = totalSec % 60;

  if (days > 0)  return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0)  return `${mins}m`;
  return `${secs}s`;
}
