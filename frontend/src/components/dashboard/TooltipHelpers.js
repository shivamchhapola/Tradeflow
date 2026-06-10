/**
 * Tooltip + checklist copy.
 *
 * Voice: trading mentor — direct, educational, no slang or emoji.
 * Each helper takes the same shape as before so call sites don't change.
 */

export function getBeginnerTranslation(score, metrics, sessionLabel) {
  // Closed-market phases (Weekend / After hours / Asian session) return null
  // on purpose. The playbook title already states the state ("Weekend — NSE
  // closed"), the action says what to do with the time, and the "Why"
  // reasoning explains the bias — adding a mentor blurb here was duplicating
  // the reasoning almost verbatim. PlaybookCard handles null gracefully:
  // the inline blurb just doesn't render, the "More context" toggle stays
  // (because `reasoning` keeps it alive), so the user still has one-click
  // access to the full explanation.
  //
  // For live-market phases, the rest of this helper builds intraday coaching
  // that's deliberately *distinct* from the data-flavored reasoning string
  // produced by the backend (e.g. reasoning = "VIX +1.5%, yields +0.5%",
  // mentor blurb = "macro is heavily bearish, sell-on-rise"). Two angles,
  // same setup, no overlap.
  if (
    sessionLabel === "Weekend" ||
    sessionLabel === "After hours" ||
    sessionLabel === "Asian session"
  ) {
    return null;
  }

  if (!metrics || score === undefined) return "Waiting for data…";

  let text = "";
  if (score >= 0.3) {
    text =
      "Macro is leaning strongly bullish. Shorting the index today is fighting the trend — look for pullback entries on the long side.";
  } else if (score <= -0.3) {
    text =
      "Macro is heavily bearish. Buying calls into this is catching a falling knife — focus on sell-on-rise setups.";
  } else if (score >= 0.1) {
    text =
      "Mild positive lean globally. Longs are favoured but the trend isn't decisive — wait for a clean setup before sizing in.";
  } else if (score <= -0.1) {
    text =
      "Mild bearish drift. Slight edge on the short side, but watch for sudden reversals.";
  } else {
    text =
      "Mixed signals. No clear direction means chop and stop-hunting — sitting on your hands is a valid play today.";
  }

  if (metrics.volatility?.includes("High") || metrics.volatility?.includes("expansion")) {
    text +=
      " Add high volatility to that — moves will be sharp. Quick profits are possible but stops must be honoured.";
  } else if (metrics.volatility?.includes("Contraction")) {
    text +=
      " Volatility is compressed — options bleed value fast in dead markets. Don't hold positions past their thesis.";
  } else if (metrics.volatility?.includes("range")) {
    text += " Volatility is normal. Realistic targets, stick to plan.";
  }

  return text;
}

export const getMetricValueTooltip = (type, val) => {
  if (!val) return "";
  const v = val.toLowerCase();
  switch (type) {
    case "volatility":
      if (v.includes("expansion")) return "High volatility: large swings expected — quick edges, also quick reversals.";
      if (v.includes("contraction")) return "Low volatility: prices stuck in a tight range. Theta will dominate.";
      if (v.includes("trend")) return "Directional: clean moves without heavy whipsaws.";
      return "Normal volatility for the session.";
    case "theta_risk":
      if (v.includes("extreme") || v.includes("high"))
        return "High theta: stagnant prices will drain your option premium fast.";
      if (v.includes("low")) return "Low theta: more room to hold without bleeding to time decay.";
      return "Moderate time-decay risk.";
    case "favorability":
      if (v.includes("buyers"))
        return "Buyers' market: large moves expected, rewards holding calls or puts.";
      if (v.includes("sellers"))
        return "Sellers' market: chop expected, rewards collecting premium via short options.";
      return "Balanced — neither side has a clear edge.";
    case "structure":
      if (v.includes("trend"))
        return "Trend day: market is likely to pick a direction and stay with it.";
      if (v.includes("compression"))
        return "Range-bound: expect a ceiling and a floor with mean reversion in between.";
      return "Directional with some choppiness.";
    case "conviction":
      if (v.includes("high"))
        return "High conviction: signals agree across the board — high-probability setup.";
      if (v.includes("choppy") || v.includes("low"))
        return "Low conviction: signals disagree. Trade smaller or stay flat.";
      return "Moderate conviction. Standard risk applies.";
    default:
      return "";
  }
};

export const getMarketTooltip = (market) => {
  switch (market) {
    case "GIFT NIFTY":
      return "GIFT NIFTY: trades nearly 24 hours — best read on the overnight gap for Indian markets.";
    case "NASDAQ":
      return "NASDAQ: tech-heavy US index. Tracks global risk-on / risk-off sentiment.";
    case "S&P 500":
      return "S&P 500: broadest measure of US equity momentum, sets global tone.";
    case "Nikkei":
      return "Nikkei: Japan's index. Sets the Asian session tone before India opens.";
    case "Crude Oil":
      return "Crude Oil: India is a net importer — high crude is bearish, low crude is bullish.";
    case "DXY":
      return "Dollar Index: a strong USD pulls capital out of emerging markets like India (bearish).";
    case "US VIX":
      return "VIX: US fear gauge. High VIX = panic (bearish risk). Low VIX = complacency (bullish risk).";
    case "US 10Y Bond":
      return "US 10Y yield: rising yields draw safe money out of equities (bearish).";
    default:
      return market;
  }
};

export const getChangeTooltip = (market, change) => {
  const isPositive = change >= 0;
  const pct = `${change.toFixed(2)}%`;
  if (market === "Crude Oil" || market === "DXY" || market === "US VIX" || market === "US 10Y Bond") {
    return isPositive
      ? `${pct} up — inversely correlated, so this is bearish for Indian equities.`
      : `${pct} down — inversely correlated, so this is bullish relief for Indian equities.`;
  }
  return isPositive
    ? `${pct} gain — positive momentum for Indian equities.`
    : `${pct} loss — negative momentum for Indian equities.`;
};

export const getContributionTooltip = (contrib) => {
  if (contrib >= 0.1) return `+${contrib.toFixed(4)} — large bullish pull on the final score.`;
  if (contrib > 0) return `+${contrib.toFixed(4)} — slight bullish contribution.`;
  if (contrib <= -0.1) return `${contrib.toFixed(4)} — large bearish drag on the final score.`;
  if (contrib < 0) return `${contrib.toFixed(4)} — slight bearish drag.`;
  return `0 — neutral impact on the final score.`;
};

export const getSignalTooltip = (sig) => {
  if (sig === "bull") return "This asset is voting up for the day.";
  if (sig === "bear") return "This asset is voting down for the day.";
  return "This asset is undecided — flat contribution.";
};

export const getChecklist = (score, metrics, sessionLabel) => {
  if (sessionLabel === "Weekend") {
    // No live session — replace intraday discipline with weekly review prompts.
    return [
      "Review this week's trades — note one pattern worth keeping, one to drop.",
      "Re-read mentor reports on losing trades; the lessons live there.",
      "Pick one concept (greeks, a strategy, an NSE rule) to study before Monday.",
    ];
  }
  if (sessionLabel === "After hours" || sessionLabel === "Asian session") {
    return [
      "Review today's executed trades in the journal.",
      "Check whether you stayed inside your daily risk limits.",
      "Rest. Tomorrow's read drops at 8:00 AM IST.",
    ];
  }

  if (score === undefined || !metrics) return ["Waiting for data…"];

  const checklist = [];

  if (Math.abs(score) >= 0.3)
    checklist.push("I will not trade against the primary trend today.");
  else if (Math.abs(score) >= 0.1)
    checklist.push("I will wait for a clean pullback before entering.");
  else
    checklist.push("I will wait for the 15-min opening range to break before committing.");

  if (metrics.volatility?.includes("expansion") || metrics.volatility?.includes("High")) {
    checklist.push("I will reduce position size — volatility is high.");
    checklist.push("I will set a hard stop and honour it.");
  } else if (metrics.volatility?.includes("Contraction")) {
    checklist.push("I will avoid holding options long — theta will eat them.");
    checklist.push("I will not force trades in a slow market.");
  } else {
    checklist.push("I will stick to my standard risk per trade.");
  }

  if (metrics.grade === "C") {
    checklist.push("Conviction is low (Grade C). Capital preservation comes first.");
  } else if (metrics.grade === "A") {
    checklist.push("Grade A setup — trust the system if my entry triggers.");
  }

  checklist.push("If I take a loss, I walk away. No revenge trades.");

  return checklist;
};

export const getBiasTooltip = (score) => {
  if (score >= 0.3) return "Strongly bullish. Macro pushing the index higher.";
  if (score <= -0.3) return "Strongly bearish. Macro dragging the index lower.";
  if (score >= 0.1) return "Slightly bullish. Mild upward tilt — don't get reckless.";
  if (score <= -0.1) return "Slightly bearish. Mild drift down — watch for traps.";
  return "Neutral. Buyers and sellers in balance — expect chop.";
};

export const getGradeTooltip = (grade) => {
  if (grade === "A") return "Grade A · high conviction. Strong score with aligned GIFT and VIX.";
  if (grade === "B") return "Grade B · moderate conviction. Good signals with some mixed data.";
  if (grade === "C") return "Grade C · low conviction. Conflicting signals across the board.";
  return "Overall conviction grade for the setup.";
};
