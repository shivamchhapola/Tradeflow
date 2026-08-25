/**
 * Tradeflow — UI copy palette.
 *
 * Voice rules:
 *   - Trading state: precise, neutral, terminal-flavored. NEVER gamified —
 *     when real-money concepts are on screen the tone stays sober.
 *   - Reward state:  brief and earned. A little momentum is OK ("nailed it",
 *     "streak alive") but no exclamation marks, no "Awesome!", no bro-talk.
 *   - Quest / quiz:  light arcade flavour (XP, quest, streak, run, shot)
 *     blended with educational intent. Reads like a smart trainer's voice,
 *     not a Duolingo owl.
 *   - Error state:   what failed + what to try, no blame.
 *   - No emoji in prose. Emoji only as functional indicators on icons:
 *       streak (flame), XP (zap), quest (target).
 *   - Prefer mentor framing over brand cheerleading.
 */

export const NAV = {
  brand: "Tradeflow",
  links: {
    analysis: "Analysis",
    trade: "Trade",
    portfolio: "Portfolio",
    reports: "Reports",
    learn: "Learn",
  },
};

export const APP_TITLE = {
  base: "Tradeflow",
  analysis: "Analysis",
  trade: "Trade",
  portfolio: "Portfolio",
  reports: "Reports",
  callback: "Linking session",
  notFound: "Not found",
};

export const SESSION = {
  premarket: "Pre-market",
  live: "Live",
  afterHours: "After hours",
  weekend: "Markets closed",
  autoFetchOn: "Live data refreshing every 5 minutes.",
  autoFetchOff: "Auto-refresh paused. Resumes at 8:00 AM IST.",
};

export const LOADING = {
  analysis: "Pulling pre-market signals…",
  portfolio: "Tallying the journal…",
  reports: "Loading review history…",
  chain: "Reading the option chain from NSE…",
  report: "Mentor is reviewing the trade…",
  auth: "Checking the API and Zerodha session…",
  authRedirect: "Opening Zerodha login…",
  generic: "Working…",
};

export const EMPTY = {
  noTrades: {
    title: "Your journal is empty",
    body: "Open a paper trade to start the loop. Every trade gets a written review.",
  },
  noReports: {
    title: "Nothing to review yet",
    body: "Close a paper trade and the mentor will write up what worked and what didn't.",
  },
  noAnalysis: {
    title: "No analysis run yet",
    body: "Run a fresh pre-market scan to generate today's bias and playbook.",
  },
  noChain: {
    title: "Option chain not loaded",
    body: "Pick an underlying and fetch the nearest weekly expiry.",
  },
  noTradesQuiet: {
    title: "Quiet day — no trades taken",
    body: "Sometimes the best trade is no trade. Capital preserved.",
  },
};

export const ERRORS = {
  analysisFailed: "Analysis failed. Check the backend logs and try again.",
  analysisNoneYet: "No analysis on record. Run one to generate today's bias.",
  backendDown: "Couldn't reach the backend. Is uvicorn running on :8000?",
  chainFailed: "Couldn't reach NSE. The chain pulls live — give it a moment and retry.",
  tradeOpenFailed: "Couldn't open the trade.",
  tradeCloseFailed: "Couldn't close the trade.",
  reportFailed: "Mentor report failed. Check your LLM provider in Settings — make sure it's running and reachable.",
  authFailed: "Couldn't link your Zerodha session.",
  formInvalid: "Some fields aren't valid. Check the highlighted inputs.",
  loginUrlFailed: "Couldn't fetch the Zerodha login URL.",
  statusFailed: "Couldn't check Zerodha session status.",
};

export const SUCCESS = {
  tradeOpened: (id) => `Trade #${id} opened.`,
  tradeClosed: (id, signedPnl) => `Trade #${id} closed · P&L ${signedPnl}`,
  reportReady: "Mentor review ready.",
  questAccepted: "Quest live. Carry it through the session.",
  authOk: "Zerodha session linked.",
};

export const XP = {
  thesis: "+15 XP when you submit a thesis (≥ 30 chars).",
  thesisShort: "Thesis logged · +15 XP",
  trade: "Trade logged · +10 XP",
  stopLoss: "Stop loss set · +20 XP",
  reportRead: "Report read · +10 XP",
  questCorrect: "Nailed it · +5 XP",
  questWrong: "Missed it. Read the explanation — that's how it sticks.",
  questPerfectBonus: "Clean run · +5 bonus",
  revenge: "Revenge trade · −25 XP",
};

export const QUEST = {
  todaysQuest: "Today's Quest",
  activeQuest: "Active Quest",
  postQuiz: "Post-Market Quiz",
  smartSitOut: "Smart sit-out",
  acceptCta: "Take the quest",
  acceptingCta: "Loading…",
  enterTrading: "Enter trading session",
  awaitingVerify: "Awaiting market close for verification.",
  verified: "Quest verified from your trades.",
  defaultTask: "Wait patiently for a clear setup.",
  smartSitOutBody:
    "No trades taken today. Sometimes the best trade is no trade — capital preserved. +10 XP banked anyway.",
  nextCta: "Next question",
  completedTitle: "Quest cleared",
  endsIn: (s) => `ends in ${s}`,
  questionOf: (n, t) => `Question ${n} of ${t}`,
};

/**
 * Phase-specific intro copy shown above the question stack in QuestCard.
 * The weekend blurb used to be "Indian markets are closed…" and was awkwardly
 * followed by a candle question with no transition — the new copy is tied to
 * what the quiz actually tests for each phase.
 */
// Phase-specific quiz intro. Kept to one short sentence per phase — the
// playbook + score card already explain the session context, so the intro
// here is just framing for the quiz itself, not another strategy nudge.
export const QUIZ_INTRO = {
  early:        "Warm-up before the 9:15 bell.",
  premarket:    "Final pre-open check — global cues and the read for the day.",
  intraday:     "Live session — pressure-test your reflexes.",
  postmarket:   "Session closed — review what separates process from luck.",
  weekend:      "Weekend drills: strategy, greeks, and NSE rules.",
  pending_reports:
    "Mentor reviews are queued — read those first, quizzes wait their turn.",
};

export const REPORTS = {
  pendingTitle: "Awaiting review",
  generateCta: "Generate review",
  generatingCta: "Reviewing…",
  thesisLabel: "Your thesis",
};

export const TRADE = {
  pageTitle: "Paper Trade",
  newTrade: "New trade",
  openPositions: "Open positions",
  optionChain: "Option chain",
  fetchChain: "Fetch chain",
  fetchingChain: "Fetching…",
  placeCta: "Place paper trade",
  placingCta: "Placing…",
  closeCta: "Close",
  cancelCta: "Cancel",
  confirmCloseCta: "Confirm close",
  closeModalTitle: "Close position",
  exitPriceLabel: "Exit price (₹)",
  exitReasonLabel: "Exit reason",
  reasonTarget: "Target hit",
  reasonStop: "Stop hit",
  reasonManual: "Manual",
  instrumentLabel: "Instrument",
  directionLabel: "Direction",
  quantityLabel: "Quantity",
  lotHint: (lot) => `1 lot = ${lot}`,
  entryLabel: "Entry premium (₹)",
  stopLabel: "Stop loss (₹)",
  targetLabel: "Target (₹)",
  thesisLabel: "Thesis (optional)",
  thesisPlaceholder: "Why this trade? What edge do you see?",
  rrLabel: "Risk : reward",
  longLabel: "LONG",
  shortLabel: "SHORT",
  longTooltip: "LONG = BUY the option (pay premium, profit if it rises).",
  shortTooltip: "SHORT = SELL the option (collect premium, profit if it decays).",
};

export const PORTFOLIO = {
  pageTitle: "Portfolio",
  level: (n) => `Level ${n}`,
  toNext: (n) => `${n} XP to next level`,
  hero: {
    balance: "Virtual balance",
    pnl: "Total P&L",
  },
  stats: {
    winRate: "Win rate",
    totalTrades: "Trades",
    avgWin: "Avg win",
    avgLoss: "Avg loss",
    streak: "Streak (days)",
    drawdown: "Max drawdown",
  },
  history: "Trade history",
  filters: {
    all: "All",
    wins: "Wins",
    losses: "Losses",
  },
  equityCurve: "Cumulative P&L",
};

export const DASHBOARD = {
  pageTitle: "Pre-Market Analysis",
  manualFetch: "Manual refresh",
  fetching: "Fetching live data…",
  scoreLabel: "Macro Bias Score",
  scoreHelp:
    "Weighted sum of overnight global moves. Positive pulls NIFTY up, negative drags it down. Range roughly −1 to +1.",
  metricsLabel: "Market Metrics",
  metricsHelp:
    "Pre-market read on how the session may behave: volatility, time-decay risk, who the conditions favour, expected day shape, and conviction grade.",
  globalLabel: "Global Markets",
  alignmentLabel: "Signal alignment",
  alignmentHint: (bull, bear) => `${bull} bull · ${bear} bear`,
  spark5d: "Last 5-day score",
};
