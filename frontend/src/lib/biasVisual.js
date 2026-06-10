/**
 * Bias meter geometry + label styling helpers.
 * Backend `market_bias` strings: Neutral, Bullish, Strong Bullish, Bearish, Strong Bearish (see engine/scoring.py).
 */

const METER_HALF_SCALE = 50;
/** Min width (% of full track) for each half so tiny scores stay visible */
export const BIAS_METER_MIN_HALF_PCT = 3;
/** Cap |score| for bar width so the meter stays in-range (model ≈ ±1) */
export const BIAS_METER_SCORE_CAP = 1;

/** Green / red / gray for the numeric score and meter — follows sign only */
export function scoreSignedClass(score) {
  const s = Number(score);
  if (s > 0) return "bullish";
  if (s < 0) return "bearish";
  return "neutral";
}

/** CSS class for the bias *word* under the meter — gray only when copy is literally Neutral */
export function biasLabelClassFromBias(marketBias, score) {
  if (marketBias === "Neutral") return "neutral";
  if (typeof marketBias === "string") {
    if (marketBias.includes("Bull")) return "bullish";
    if (marketBias.includes("Bear")) return "bearish";
  }
  return scoreSignedClass(score);
}

/**
 * @returns {{ leftPct: number, widthPct: number, tone: 'bullish'|'bearish'|'neutral' }}
 * `tone` matches score sign (meter colors), not the neutral verbal band.
 */
export function getBiasMeterFill(score) {
  const s = Number(score);
  const abs = Math.abs(s);
  if (abs < 1e-9) {
    return { leftPct: 50, widthPct: 0, tone: "neutral" };
  }
  const absCapped = Math.min(abs, BIAS_METER_SCORE_CAP);
  const rawW = Math.min(absCapped * METER_HALF_SCALE, 50);
  const widthPct = Math.max(rawW, BIAS_METER_MIN_HALF_PCT);
  const tone = scoreSignedClass(s);
  const isBull = s > 0;
  const leftPct = isBull ? 50 : 50 - widthPct;
  return { leftPct, widthPct, tone };
}
