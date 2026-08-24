# Tradeflow — Comprehensive Technical Documentation

This document serves as the absolute ground truth for how the Tradeflow backend engine is implemented, integrating data scraping, FastAPI endpoints, local SQLite storage, APScheduler cron jobs, and LLM report generation.

---

## 1. High-Level Architecture

Tradeflow is a Python-based FastAPI backend that connects to a React frontend. It functions as a simulated options trading environment with an intelligent pre-market analysis tool.

*   **Framework:** FastAPI (Python 3.10+)
*   **Database:** SQLite (`tradeflow.db`) utilizing WAL mode for better concurrency. Every request opens a transient connection via `get_db()`. No global ORM is used; raw SQL is passed with `sqlite3.Row` factory for dict-like behavior.
*   **Background Jobs:** `APScheduler` running in the same process as Uvicorn to manage time-based workflows like pre-market analysis runs and auto-square-offs.
*   **External APIs:**
    *   **NSE India:** GIFT Nifty (pre-market), NIFTY 50 ~1m index chart (`indexTrackerApi`), option chain, and option premium charts.
    *   **yfinance:** Used to fetch global macro indicators.
    *   **LLM (configurable):** Ollama (local, default) or Groq cloud — switchable at runtime via `settings.json` and the frontend Settings page.

---

## 2. Market Data Integration (The `fetcher` & `nse` modules)

The system relies on aggregating multiple disparate data sources accurately. This is handled by `data/fetcher.py` and `data/nse.py`.

### 2.1 GIFT Nifty Fetching (NSE-only)
GIFT Nifty reflects overnight market sentiment as it trades nearly 24 hours. The fetcher calls NSE's public `https://www.nseindia.com/api/marketStatus` endpoint and parses `data['giftnifty']['PERCHANGE']`.
*   **No Kite hop.** A previous version chained `user's Kite token → freshest Kite token → NSE`, but the Kite call required the NSEIX (GIFT IFSC) segment subscription which most retail Zerodha accounts don't have, so the chain was always falling through to NSE in practice. The dead branches (`_fetch_kite_change_pct`, `pick_freshest_kite_token`, `KITE_SYMBOL_MAP`) were removed. **Do not re-add Kite to GIFT NIFTY** unless you've confirmed the active user has NSEIX enabled — otherwise you're paying complexity for a path that never fires.
*   **Crucial NSE pattern:** Create `requests.Session()`, GET `https://www.nseindia.com/` to warm cookies, *then* hit `/api/marketStatus`. NSE returns 401/403 on direct calls without the cookie.
*   **`fetch_market_data()`** — NSE + yfinance only. Optional `user_id` param is accepted but unused.

### 2.2 Global Indices Fetching
*   **Source:** `yfinance`
*   **Symbols tracked:** `^IXIC` (NASDAQ), `^GSPC` (S&P 500), `^N225` (Nikkei), `CL=F` (Crude Oil), `DX-Y.NYB` (DXY), `^VIX` (US VIX), `^TNX` (US 10Y Bond).
*   **Optimization:** Fetched concurrently using a `ThreadPoolExecutor` where `yf.Ticker(symbol).history(period="2d")` calculates the exact % change over the last 2 days.

### 2.3 Option Chain & Option Premium Chart (Trade tab)
*   **NSE option chain** via `option-chain-contract-info` + `option-chain-v3`. Returns `fetched_at`, `source: "nse"`, `delay_note`.
*   **Auto-refresh:** frontend polls chain + chart every **60s** only when `marketPhase === "live"` (9:15–15:30 IST weekdays). Manual refresh always available.
*   **NSE Option Chain Endpoints:** `https://www.nseindia.com/api/option-chain-contract-info?symbol=NIFTY` then `https://www.nseindia.com/api/option-chain-v3?type=Indices&symbol=NIFTY&expiry={expiry}`. The older `/api/option-chain-indices?symbol=NIFTY` endpoint can return `{}` in the current NSE frontend flow, so the Trade page follows NSE's current two-step option-chain page sequence.
*   **Selected option chart:** `https://www.nseindia.com/api/chart-databyindex?index={option_identifier}&indices=false`, where `option_identifier` comes from the selected CE/PE row in the option-chain payload. The backend aggregates NSE tick points into 5-minute OHLC candles for chart rendering.
*   **Parsing Logic (`data/nse.py`):**
    1.  Warms the shared NSE session and the option-chain page before API calls.
    2.  Fetches contract info and picks the nearest expiry that is `>= today`.
    3.  Fetches `option-chain-v3` with that explicit expiry.
    4.  Extracts LTP, LTP % change (`pChange` → `ce_ltp_chg_pct` / `pe_ltp_chg_pct`), open interest, OI % change (`pchangeinOpenInterest` or derived from `changeinOpenInterest` → `ce_oi_chg_pct` / `pe_oi_chg_pct`), implied volatility, volume, and NSE identifiers for Calls (CE) and Puts (PE). Missing NSE fields are returned as `null`, not invented.
    5.  Fetches selected option premium chart points by identifier and aggregates them to candles.


#### 2.4 NIFTY 50 Candlestick & Context Chart (Trade Page)
*   **Source:** NSE `indexTrackerApi?functionName=getIndexChart&index=NIFTY%2050&flag=1D` — same endpoint as the NSE website index chart. Backend buckets `grapthData` into **~1m OHLC** candles (`data/nifty_chart.py`).
*   **Default display:** lightweight-charts with configurable visible range (1H / 2H / 4H / day) and optional SMA 9/21 overlays.
*   **API Response:** The `/api/nifty-chart` endpoint has been upgraded to return both the legacy `points` array (for line-chart backward compatibility) and a new `candles` array containing structured OHLC candles (`{time, open, high, low, close}`).
*   **Chart Decoupling & Navigation:**
    *   Clicking anywhere on a call or put **leg** (OI, IV, LTP columns for that side) charts that option's premium candlestick chart. LTP is plain text with % change below; chart selection is a subtle leg highlight, not a colored LTP button.
    *   When charting an option premium, a sleek "Back to NIFTY 50 Index" button appears in the chart header, allowing the user to easily toggle back to the main index.
    *   **B** / **S** appear on row hover; clicking them opens the TradeTicket side panel and charts that contract (click does not propagate to the leg chart handler).
*   **Frontend layout:** The Trade page uses `lightweight-charts` for premium and index candlestick rendering, with client-side SMA 9/21 overlays. The TradeTicket orders form slides out in a non-scrollable third panel (`.trade-ticket-panel`) on the right side of the screen, creating a professional-grade trading terminal UI that completely avoids page-level vertical scrolling.

---

## 3. Core Engine Modules

### 3.1 Scoring Engine (`engine/scoring.py`)
Computes a macro bias score based on predefined weights in `config.py`.

*   **`analysis_time` is a full IST ISO datetime** (e.g. `2026-05-17T08:12:34+05:30`), not `HH:MM:SS`. The dashboard renders a relative `Updated Xm ago` chip next to the manual-refresh button, and the cached-row code path in `main.py` (`/api/analysis`) returns `premarket_logs.run_at` for the same field — both must remain ISO-with-tz so `new Date(...)` parses correctly on the client. If you change one, change the other.

*   **Weights Logic:** Each asset's `% change` is multiplied by its weight and divided by 100.
    *   *Positive weights* (e.g., GIFT Nifty +0.40) pull the Nifty in their direction.
    *   *Negative weights* (e.g., DXY -0.15) push the Nifty in the opposite direction.
*   **Output:** Generates a `final_bias_score` ranging loosely from -1.0 to 1.0, and assigns a bias label (e.g., "Strong Bullish" if >= 0.3).

### 3.2 Playbook Engine (`engine/playbook.py`)
Takes the raw quant score and translates it into an actionable trading thesis.
*   **Timezone Enforcement:** Strictly uses `pytz.timezone("Asia/Kolkata")` to determine market phases (Asian Session, Pre-Market, Market Open).
*   **Signal Alignment:** Computes a delta between bullish macro signals and bearish macro signals.
*   **Volatility Assessment:** Analyzes VIX and Crude Oil thresholds to determine Theta Risk and Option Buyer Favorability.
*   **Scenarios:** Hardcoded logical branches detect systemic fear (VIX + Yields surging), "Fake-outs" (GIFT Nifty strong but macros weak), or trend days.
*   **`warnings` field — additive only:** the returned `metrics.warning` list is intentionally restricted to information *not* already conveyed by the scenario title or the conviction grade. Specifically, weekend / after-hours / Asian-session "markets are closed" warnings and the "conflicting data" grade-C warning are **no longer emitted** — the playbook scenario block (`title` + `reason`) and the grade circle on the dashboard already state those facts. Only genuinely additive risks remain: VIX-plus-yields systemic fear, GIFT vs. macro gap-and-crap, and GIFT vs. macro bear-trap. This is a UX redundancy fix; if you re-add a warning, make sure it expresses something the rest of the playbook payload doesn't.

---

## 4. Paper Trading & Gamification

Located in `trades/paper.py`, this module handles CRUD operations for paper trades and implements the XP logic.

### 4.1 Trade Execution
*   **Opening:** Trades require an instrument string, direction (BUY/SELL), quantity, stop loss, and target.
*   **Revenge Trade Penalty:** When a new trade is opened, the DB checks for the user's last *losing* trade. If a loss was closed less than 300 seconds (5 minutes) ago, a -25 XP penalty is applied to enforce discipline.
*   **Closing:** Calculates absolute P&L (`(exit - entry) * qty` inverted for SELLs) and updates the virtual portfolio balance which starts at ₹500,000.

### 4.2 Auto Square-Off
*   To mimic real broker behavior, all open Intraday trades must be squared off before the market closes.
*   **Execution:** A cron job runs at 15:15 IST. It triggers an internal endpoint that parses open instrument strings (e.g., "NIFTY 24500 CE").
*   **Optimization:** It hits the `get_option_chain()` API to find the live LTP of that specific strike and option type to close the trade accurately. To avoid rate-limiting, it caches the option chain payload per symbol during the square-off loop.

### 4.3 Activity Streak (`trades/paper.py::bump_activity_streak`)
*   **What counts as "activity"**: any XP-earning action — opening a trade, manually closing a trade, completing a quest, or saving an LLM report. The auto square-off cron path is intentionally excluded (calls `close_trade(..., exit_reason="auto_squareoff")` which skips the streak bump) so a user doesn't get rewarded for a system action.
*   **Trading-day semantics**: the streak counts weekdays. Weekend activity updates `last_active` ("last seen") but never touches `streak_days` or `last_streak_day` — NSE is closed Sat/Sun and the platform shouldn't punish or reward those days. The Fri → Mon continuation works because the helper compares today's date (Monday) to `last_streak_day` (Friday), skipping Sat/Sun via `_previous_trading_day()`.
*   **Idempotent per IST day**: calling `bump_activity_streak` twice on the same weekday only ticks the counter on the first call; subsequent calls just refresh `last_active`.
*   **NSE holidays are not modelled.** The official list changes yearly. A user who misses *only* a holiday will see their streak reset — a known false positive, deferred until it becomes a real complaint.

---

## 5. LLM Reporting (`trades/report.py` + `llm/`)

*   **Provider:** Configurable at runtime — Ollama (local, default: `qwen3.5:4b`) or Groq (cloud, default: `llama-3.1-8b-instant`). The active provider is read from `settings.json` on every report request.
*   **Abstraction:** `llm/provider.py` defines a `LLMProvider` base class with `generate(prompt)` and `health_check()` methods. `llm/ollama.py` and `llm/groq.py` implement it. Factory `get_llm_provider()` reads settings and returns the right instance.
*   **Trigger:** Manual request to `/api/trades/{id}/report`.
*   **Context:** Pulls both the paper trade data from the DB and the corresponding pre-market log (`premarket_id`) that was active when the trade was opened.
*   **Prompt Strategy:** Forces the LLM to act as a mentor, generating exactly 5 sections (What happened, Where it went right/wrong, Textbook mechanics, Verdict on Process, and 1 specific takeaway). Stresses "process over profit".
*   **Structured extraction:** After generation, `_strip_think()` removes any `<think>` blocks, then `_extract_structured_tokens()` pulls `THESIS_SCORE: N/10` and `PROCESS_VERDICT: EXCELLENT|GOOD|NEEDS_WORK` via regex.
*   **Switching providers:** No code change needed — change `llm.provider` in `settings.json` (or use the Settings UI). The next report request uses the new provider.

---

## 6. Schedulers & Automations (`scheduler.py`)

Uses `BackgroundScheduler` from `apscheduler`:
1.  **`premarket_analysis`**: Runs `cron` at `08:00` IST (`mon-fri`). Makes an HTTP POST to `/api/analysis/run`.
2.  **`auto_squareoff`**: Runs `cron` at `15:15` IST (`mon-fri`). Makes an HTTP POST to `/api/trades/auto-squareoff`.

---

## 7. Database Schema (`database.py`)

*   **`premarket_logs`**: `id`, `date`, `run_at`, `score`, `bias`, `grade`, `metrics` (JSON), `market_data` (JSON), `playbook_title`, `playbook_reasoning`, `playbook_action`, `session` (JSON). Each `/api/analysis/run` **appends** a new row (same `date` may appear many times) so pre-open OHLC history is preserved; `GET /api/analysis` still returns the latest row for today via `ORDER BY run_at DESC LIMIT 1`.
*   **`paper_trades`**: `id`, `opened_at`, `closed_at`, `instrument`, `direction`, `quantity`, `entry_price`, `exit_price`, `stop_loss`, `target`, `thesis`, `exit_reason`, `pnl`, `premarket_id` (FK), `report`, `xp_earned`.
*   **`user_stats`**: `id`, `user_id` (UNIQUE), `total_xp`, `streak_days`, `last_active`, `last_streak_day`, `virtual_balance`. `last_active` is updated on every XP-earning action including weekend logins (used as a "last seen" timestamp). `last_streak_day` is the ISO date of the most recent **weekday** on which the user earned XP — used for the prev-trading-day comparison that extends the streak across the Fri → Mon gap without counting weekend logins.
*   **`daily_quests`**: `id`, `date`, `phase`, `status` (`pending`/`accepted`/`completed`/`expired`), `xp_awarded`, `quiz_results` (JSON list `[{id, answer, correct, answered_at}]`), `total_questions` (default 3), `correct_count`, `started_at`, `expired_at`. **`UNIQUE(date, phase)`** — one quest per phase per day. Legacy `quiz_answer` / `quiz_correct` columns are retained for back-compat reads from rows created before the migration; new rows do not write them. Schema migration in `database.py::_migrate_daily_quests_unique` rebuilds the table when the old `UNIQUE(date)` is detected.

---

## 8. API Endpoint Summary

*   `GET /api/analysis`: Returns today's playbook from the **latest** `premarket_logs` row for today's IST calendar date. If > 5 mins old (during market hours), automatically triggers a new run and appends a snapshot.
*   `POST /api/analysis/run`: Forces a fresh data fetch and **inserts** a new `premarket_logs` snapshot (does not overwrite prior rows for that date).
*   `GET /api/analysis/history?days=N`: Raw log rows (all times) for charting or audits.
*   `GET /api/analysis/history-candles?days=N`: Per-day OHLC of `score` grouped by **`premarket_logs.date`**, using only rows whose `run_at` resolves to **08:00–09:15:59 IST** on that same calendar date (naive timestamps try UTC and IST wall clocks; readings that roll to the **next** IST day are excluded so evening UTC runs do not masquerade as pre-open). For each day, eligible rows are sorted by resolved IST instant; **open** / **close** are the **first** / **last** snapshot’s `score` in that window; **high** / **low** are min/max `score` over included snapshots. **`end_bias`** is the **`bias`** text from the same row as **close** (last valid score in the window). The dashboard charts **`close`** as a line (end-of-window macro score).
*   `GET /api/option-chain?symbol=NIFTY`: Proxies and filters the NSE Option Chain.
*   `GET /api/option-candles?identifier=...&interval_seconds=60`: NSE option premium chart (1m buckets when `interval_seconds=60`).
*   `GET /api/nifty-chart`: NSE indexTrackerApi ~1m NIFTY 50 candles.
*   `POST /api/trades`: Opens paper trade.
*   `POST /api/trades/auto-squareoff`: Closes open trades at live market prices.
*   `POST /api/trades/{trade_id}/close`: Closes a trade manually or via hit SL/Target.
*   `POST /api/trades/{trade_id}/report`: Invokes the configured LLM provider (Ollama or Groq — read from `settings.json`), saves report text + thesis_score + process_verdict to DB.
*   `GET /api/stats`: Computes win rate, average win/loss, and max drawdown on the fly.
*   `GET /api/settings`: Returns current runtime settings (API keys masked). Requires auth.
*   `PUT /api/settings`: Partial deep-merge update to `settings.json`. Requires auth.
*   `GET /api/settings/llm/status`: Health-check the configured LLM provider (pings Ollama or validates Groq key).
*   `POST /api/settings/llm/test`: Sends a brief test prompt to verify LLM end-to-end.
*   `GET /api/quests/today`: Returns the active quest for the current `(date, phase)`. The resolver auto-expires any in-progress quest whose phase no longer matches the natural phase (e.g. weekend quest still open when intraday begins). Response includes `phase` (the *display* phase, may be a `pending_reports` / `quiz_backlog` nudge), `natural_phase` (the actual underlying phase, used for the countdown timer), `quest` (DB row + `quiz_results` parsed), `questions` (server-side stripped — `correct` and `explanation` removed), and `current_index` (next unanswered question).
*   `POST /api/quests/today`: Idempotent status update. Currently accepts `{ status: "accepted" }` only; scoring lives in the answer endpoint.
*   `POST /api/quests/today/answer`: Validates `{ question_id, answer }` server-side against the bank, appends to `quiz_results`, marks the quest `completed` on the final answer and credits `user_stats.total_xp` with `correct_count * 5 + (perfect ? 5 : 0)`. Returns `correct`, `correct_answer`, `explanation`, `quest_complete`, `xp_awarded`, `next_index`. Returns `409` if the quest is already completed/expired or the phase has changed under the client.
*   `GET /api/quests/recent?limit=5`: Last N settled (`completed` or `expired`) quests, most recent first. Powers the dashboard footer dot strip.

## 9. Quest & Quiz Engine

*   **Bank**: `backend/engine/quiz_bank.py` holds ~35 categorised questions (`candles`, `greeks`, `strategies`, `risk`, `macro`, `pre_market`, `psychology`, `nse_specifics`) with stable string IDs (e.g. `macro.pcr.basic`). Each question carries `difficulty` (1–3), `options`, `correct`, and `explanation`.
*   **Selection**: `select_questions(date, phase, user_id, count)` is deterministic — same args always produce the same set. Uses a per-(date, phase, user) SHA-256 seed and weights categories per phase via `PHASE_CATEGORY_BIAS`. A first pass prefers category diversity; a fallback fills if the diversity rule starves the pool.
*   **Phase resolver**: `backend/engine/quest_phases.py::compute_natural_phase(now)` returns one of `early` / `premarket` / `intraday` / `postmarket` / `weekend` from IST wall-clock + weekday. `PHASE_PRIORITY` ranks them so the API can detect a stale quest and expire it cleanly. `next_phase_boundary` is used by the UI countdown.
*   **Server-side cheat protection**: The client never receives `correct` or `explanation` until it submits an answer. The answer endpoint re-validates the question ID against today's chosen set and looks the correct answer up in the bank — submitting a question ID that isn't part of today's quest returns `400`.
*   **Phase 2 (LLM-personalised quizzes)**: Swap the body of `select_questions(...)` to call Groq with the user's recent closed trades and mentor reports, keeping the same return shape and the same `correct`/`explanation` keys. No API or DB changes needed.

## 10. Runtime Settings System

### 10.1 Two-layer config

Tradeflow separates **bootstrap secrets** (`.env`, loaded once at startup) from **runtime settings** (`settings.json`, read on every access, mutable via API).

| Layer | File | Mutable at runtime? | Contains |
|-------|------|---------------------|----------|
| `.env` | `backend/.env` | No (needs restart) | `JWT_SECRET`, `ADMIN_BOOTSTRAP_*` |
| `settings.json` | project root | Yes (API + hand-edit) | LLM provider, data sources, schedule |

### 10.2 Settings store (`backend/settings.py`)

*   **Storage:** Plain JSON file at project root (next to `tradeflow.db`). Gitignored.
*   **Defaults:** Missing keys auto-filled from `DEFAULTS` dict on read.
*   **Writes:** Deep-merge + atomic write (temp file → `os.replace()`).
*   **Validation:** Provider names clamped to known values; unknown keys preserved.
*   **No in-memory cache:** File is re-read on every `get_settings()` call — acceptable for single-user and avoids stale state.

### 10.3 Schema (v1)

```json
{
  "version": 1,
  "llm": {
    "provider": "ollama",          // "ollama" | "groq"
    "ollama_base_url": "http://localhost:11434",
    "ollama_model": "qwen3.5:4b",
    "groq_api_key": "",
    "groq_model": "llama-3.1-8b-instant"
  },
  "data_sources": {
    "option_chain": "nse",
    "gift_nifty": "nse"
  },
  "general": {
    "auto_squareoff_time": "15:15",
    "premarket_cron_time": "08:00"
  }
}
```

### 10.4 API endpoints

*   `GET /api/settings` — returns settings with API keys masked (last 4 chars only).
*   `PUT /api/settings` — partial update (deep merge). Send only the keys you want to change.
*   `GET /api/settings/llm/status` — pings Ollama or validates Groq key.
*   `POST /api/settings/llm/test` — sends a test prompt, returns response preview + latency.

All settings endpoints require authentication.

### 10.5 Frontend Settings page

Accessible at `/settings` via the user dropdown menu. Sections:
1. **LLM Provider** — toggle Ollama/Groq, configure model + URL/key, test connection
2. **Data Sources** — informational (NSE, yfinance) with future expansion planned
3. **Schedule** — display-only cron times
4. **About** — version + links

---

## 11. Authentication & Authorization

### 11.1 Backend (`backend/auth/`)
*   **`security.py`** — bcrypt password hashing via passlib (`hash_password`, `verify_password`) and HS256 JWT issuance via PyJWT (`create_access_token`, `decode_access_token`). Tokens carry `{sub, email, iat, exp}` and live 30 days. The HMAC secret comes from the `JWT_SECRET` env var; if absent, a loud warning is logged and an insecure dev default is used — never deploy without setting it.
*   **`dependencies.py`** — FastAPI deps:
    *   `get_current_user(authorization=Header(None))` — required-auth dep. Reads `Authorization: Bearer <jwt>`, decodes, loads the user row, returns dict. Raises `401` on any failure (with `WWW-Authenticate: Bearer`).
    *   `get_current_user_optional` — same logic but returns `None` instead of raising. Used by `/api/analysis*` so both background cron runs (no auth) and authenticated requests work; the analysis pipeline itself doesn't read the user (GIFT NIFTY is NSE-only) but the param is kept ready for the Trade tab.
*   **`routes.py`** — `APIRouter(prefix="/api/auth")` mounting `/signup`, `/login`, `/me`, `/change-password`. Email is lowercased on every comparison. `POST /signup` creates `users` + `user_stats(user_id=…)` atomically and returns a fresh JWT.

### 11.2 Bootstrap migration (`database.py::_bootstrap_user_if_needed`)
On the first run after auth lands, if `users` is empty AND any row exists in `paper_trades` / `user_stats` / `daily_quests` with `user_id IS NULL`, the migrator creates a placeholder user (`ADMIN_BOOTSTRAP_EMAIL`/`PASSWORD` env vars, defaults `you@local`/`tradeflow`) and backfills the existing rows with that `user_id`. A warning is logged telling the operator to change the password via `POST /api/auth/change-password`.

### 11.3 Route protection
All user-scoped backend routes use `Depends(get_current_user)`:
*   `/api/trades` (POST, GET open, GET history, POST {id}/close, POST {id}/report)
*   `/api/stats`
*   `/api/quests/today`, `/api/quests/today/answer`, `/api/quests/recent`
Public/optional:
*   `/api/auth/{signup,login}` — no auth, login returns a fresh JWT.
*   `/api/analysis`, `/api/analysis/run` — *optional* auth so the cron can still hit them.
*   `/api/trades/auto-squareoff` — public, hit by the in-process scheduler. Skips rows without `user_id`.

### 11.4 Frontend
*   **`src/lib/auth.js`** — small wrapper over `localStorage` keyed `tradeflow.token`. Includes a `tokenExpUnix` helper that decodes the JWT payload without verifying signature, used to skip a pointless `/me` call on boot when the token is already expired.
*   **`src/api.js`** — axios request interceptor attaches `Authorization: Bearer <token>`. Response interceptor: on `401` (excluding the auth endpoints themselves) it clears the token and dispatches `tradeflow:auth-expired` so `AuthContext` can transition to a logged-out state from anywhere.
*   **`src/context/AuthContext.jsx`** — top-level provider mounted in `main.jsx`. Bootstraps `user` + `stats` from `/api/auth/me` on first render and exposes `login`, `signup`, `logout`, `refreshStats`. Also invalidates the shared `useStats` cache on every login/logout/expiry transition to prevent showing the previous user's XP.
*   **`src/components/AuthWrapper.jsx`** — gate. `/login` and `/signup` are public.

---

## 12. Deferred: Achievements

Scoped but not yet built. Lives here so future-you doesn't redesign the schema
from scratch when Portfolio gets the achievement grid. See
`product_plan.md::Badges` for the user-facing list and copy.

### 11.1 Schema sketch

```sql
CREATE TABLE achievements (
  id          TEXT PRIMARY KEY,        -- 'first_thesis', 'stop_respected', ...
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  category    TEXT,                    -- 'discipline' | 'learning' | 'consistency'
  icon        TEXT                     -- lucide icon name
);

CREATE TABLE user_achievements (
  user_id        INTEGER NOT NULL,
  achievement_id TEXT    NOT NULL,
  earned_at      TEXT    NOT NULL,     -- ISO IST timestamp
  PRIMARY KEY (user_id, achievement_id),
  FOREIGN KEY (user_id)        REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (achievement_id) REFERENCES achievements(id)
);
```

`achievements` is seeded once at startup (similar to `quiz_bank.py`'s static
catalogue); `user_achievements` is per-grant. Use `INSERT OR IGNORE` so the
award trigger is idempotent — calling it twice for the same milestone is a
no-op rather than an error.

### 11.2 Award trigger wiring

| Achievement      | Trigger point                                                 |
| ---------------- | ------------------------------------------------------------- |
| `first_thesis`   | `open_trade()` — first trade where `thesis` is non-empty      |
| `stop_respected` | `close_trade(exit_reason="stop_hit")` and SL wasn't moved     |
| `consistent`     | `bump_activity_streak()` reaches `streak_days == 5`           |
| `disciplined`    | rolling count: 10 trades with `exit_reason == "stop_hit"`     |
| `student`        | `save_report()` — 10th report read by the same user           |
| `thesis_trader`  | 20 consecutive trades with non-empty `thesis` (rolling check) |
| `quest_streak`   | quest completion endpoint — 5 consecutive non-expired quests  |
| `perfect_score`  | quest completion — 5 quests with `correct_count == total`     |
| `first_report`   | `save_report()` — first ever for that user                    |

All triggers are silent inserts (no toasts on earn — surfaced on Portfolio
visit only). Per-user Sonner toasts on the badge page are the right place to
acknowledge new earns — don't bolt them into the trade-close flow.

### 11.3 Why deferred

Achievements need: (a) the schema above, (b) a Portfolio-page grid to
display them, (c) a recompute job for retroactive grants when a new badge
is added. None of (a–c) belong in the Analysis-page polish pass. Build the
whole vertical slice when Portfolio gets the redesign so we ship a coherent
feature instead of half a backend.

---

## 13. Notifications Center & 10,000 DB Cap Pruning

### 13.1 Schema & Indexing
The `notifications` table stores events per user:
* `id` (INTEGER PK)
* `user_id` (INTEGER FK → `users.id`, indexed)
* `type` (TEXT, indexed): `trade_executed`, `stop_hit`, `target_hit`, `manual_close`, `auto_squareoff`, `system_error`, `info`, `warning`
* `title` (TEXT): Short digestible title
* `message` (TEXT): Short digestible summary
* `details` (TEXT, optional): Detailed stack trace or JSON payload for error inspection
* `is_read` (BOOLEAN, indexed)
* `created_at` (TEXT, indexed)

### 13.2 10,000 Cap & 1,000-Row Pruning Algorithm
* To maintain lightweight SQLite performance over time, `database.py::create_notification()` tracks notification counts per `user_id`.
* When a user reaches **10,000 notifications**, the backend executes a subquery deletion pruning the oldest **1,000 notifications** for that user in a single operation:
```sql
DELETE FROM notifications WHERE id IN (
  SELECT id FROM notifications WHERE user_id = :user_id ORDER BY id ASC LIMIT 1000
);
```

### 13.3 API Cursor Pagination
* Endpoints: `GET /api/notifications` supports `limit` (default 20), `before_id` (cursor), `unread_only`, and `type_category`.
* Cursor-based pagination (`id < before_id`) guarantees smooth infinite scrolling in the frontend without duplicate items or pagination offset shifts.

### 13.4 Frontend Instagram-Style Overlay & Error Modal
* **`NotificationBell.jsx`**: Floating unread badge counter in header navbar.
* **`NotificationDrawer.jsx`**: Popover feed drawer with category tabs ("All", "Unread", "Trades", "Errors") and relative timestamps ("2m ago"). Employs an `IntersectionObserver` sentinel for continuous infinite scroll.
* **`ErrorDetailsModal.jsx`**: Opened when clicking "View Error Details" on error cards. Displays title, timestamp, message digest, and a copyable code block containing full stack traces / server error payloads.

