# Tradeflow — Product Plan

## What It Is

An interactive FnO (Futures & Options) learning platform that connects **real market conditions** to **contextual education** through **paper trading with intelligent feedback**. Built for one user (you), designed to be open-sourceable later.

> [!IMPORTANT]
> This is NOT a trading bot. This is a structured environment to learn trading without losing real money. The LLM explains outcomes — it doesn't generate signals.

---

## The Core Loop

```
Morning (8:00 AM IST)
  └── Pre-market analysis runs automatically
  └── Scores global markets, generates playbook
  └── "Today: Macro-Aligned Bearish, Grade A"

Market Hours (9:15 AM – 3:30 PM)
  └── Live/delayed option chain from NSE
  └── User enters paper trade with:
        → Instrument, direction, quantity
        → Stop loss + target (mandatory)
        → Written thesis (earns XP)
  └── P&L updates periodically

Trade Closes (SL hit / target hit / manual / 3:15 auto)
  └── LLM generates detailed trade report
  └── XP awarded for process, not profit

End of Day
  └── Day summary: thesis vs reality
  └── Historical log updated
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Your PC / Pi                      │
│                                                      │
│  ┌──────────────┐     ┌───────────────────────────┐ │
│  │   Frontend    │────▶│       Backend (API)        │ │
│  │  React/Vite   │     │       FastAPI              │ │
│  │  Port 5173    │◀────│       Port 8000            │ │
│  └──────────────┘     │                             │ │
│                        │  ┌─────────┐ ┌───────────┐ │ │
│                        │  │ Engine  │ │  Trades   │ │ │
│                        │  │ scoring │ │  paper    │ │ │
│                        │  │ playbook│ │  report   │ │ │
│                        │  └────┬────┘ └─────┬─────┘ │ │
│                        │       │            │       │ │
│                        │  ┌────▼────────────▼─────┐ │ │
│                        │  │      SQLite DB        │ │ │
│                        │  │  premarket_logs       │ │ │
│                        │  │  paper_trades         │ │ │
│                        │  │  user_stats           │ │ │
│                        │  └───────────────────────┘ │ │
│                        └───────────────────────────┘ │
│                                                      │
│  External APIs:                                      │
│    yfinance ── global market data                    │
│    NSE API ─── GIFT Nifty (pre-market)               │
│                & option chain (delayed fallback)     │
│    Zerodha ─── Kite Connect API (real-time trading)  │
│    Groq ────── LLM trade reports (free tier)         │
└─────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Tool | Why |
|-------|------|-----|
| **Backend** | FastAPI (Python) | Auto-docs, async, dead simple |
| **Frontend** | React + Vite | SPA with game-like navigation, fast HMR |
| **Database** | SQLite | Zero setup, file-based, enough for years |
| **Market data** | yfinance | Free, stable, covers all indices/commodities |
| **Pre-market** | NSE API (`/marketStatus`) | Real-time sentiment via GIFT Nifty |
| **Option chain** | NSE (default) / Kite Connect (paid upgrade) | NSE free feed (~15m delayed); Kite only when user has paid Connect market-data access |
| **LLM** | Groq API (LLaMA 3) | Free tier: 14,400 req/day, fast inference |
| **Scheduling** | APScheduler | In-process cron, no external service needed |
| **Styling** | Vanilla CSS | Full control, tasteful dark theme from GAS version |

**Total cost: ₹0**

---

## Project Structure

```
e:\Tradeflow\
├── backend\
│   ├── main.py                  # FastAPI app entry point
│   ├── settings.py              # Runtime config store
│   ├── database.py              # SQLite + SQLModel setup
│   ├── models.py                # SQLModel definitions
│   ├── schemas.py               # Pydantic validation models
│   ├── scheduler.py             # APScheduler jobs
│   ├── settings.json            # Dynamic config file (ignored in git)
│   ├── .env                     # Bootstrap secrets
│   │
│   ├── auth/                    # Auth module
│   ├── data/                    # Fetchers (yfinance, NSE)
│   ├── engine/                  # Core scoring & playbooks
│   ├── llm/                     # LLM Provider Abstraction
│   │   ├── provider.py          # Base class
│   │   ├── ollama.py            # Local inference
│   │   └── groq.py              # Cloud inference
│   ├── routes/                  # FastAPI routers (including settings)
│   └── trades/                  # Trade & report execution
│
├── frontend\
│   ├── src\
│   │   ├── main.jsx
│   │   ├── App.jsx              # Router + nav
│   │   ├── App.css              # Global styles + design system
│   │   ├── api.js               # Axios instance + API helpers
│   │   ├── pages\
│   │   │   ├── Dashboard.jsx    # Pre-market analysis view
│   │   │   ├── Trade.jsx        # Paper trade entry + option chain
│   │   │   ├── Portfolio.jsx    # P&L, stats, XP, streaks
│   │   │   ├── Reports.jsx      # Post-trade LLM reports
│   │   │   ├── Learn.jsx        # Quiz/Educational section
│   │   │   └── Settings.jsx     # Integration config (LLM/Data)
│   │   └── components\
│   │       ├── ScoreCard.jsx    # Bias score + bar
│   │       ├── MarketTable.jsx  # Asset table with signals
│   │       ├── PlaybookCard.jsx # Playbook scenario card
│   │       ├── TradeForm.jsx    # Trade entry form
│   │       ├── OptionChain.jsx  # Strike table
│   │       ├── StatsGrid.jsx   # Portfolio stats cards
│   │       └── ReportCard.jsx  # Single trade report
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── docs\                        # AI Agent Knowledge Base
│   ├── architecture.md          # System layout
│   ├── decisions.md             # ADRs
│   ├── llm-providers.md         # Groq vs Ollama docs
│   └── settings-system.md       # Config architecture
│
├── .github\
│   └── workflows\
│       └── fetch.yml            # Daily cron backup (GitHub Actions)
│
├── .gitignore
└── README.md
```

---

## Data Model

### `premarket_logs`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| date | TEXT | YYYY-MM-DD |
| run_at | TEXT | ISO timestamp |
| score | REAL | Final bias score |
| bias | TEXT | "Strong Bullish", "Bearish", etc. |
| grade | TEXT | A / B / C |
| metrics | TEXT (JSON) | Full metrics object |
| market_data | TEXT (JSON) | Per-asset data array |

Multiple rows may share the same `date`: each `/api/analysis/run` appends a snapshot (append-only) so pre-open OHLC and audits remain available.

### `paper_trades`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| opened_at | TEXT | ISO timestamp |
| closed_at | TEXT | ISO timestamp (null if open) |
| instrument | TEXT | e.g. "NIFTY 24000 CE" |
| direction | TEXT | BUY / SELL |
| quantity | INTEGER | Lot size |
| entry_price | REAL | Entry premium |
| exit_price | REAL | Exit premium (null if open) |
| stop_loss | REAL | Mandatory |
| target | REAL | Mandatory |
| thesis | TEXT | User's trade rationale |
| exit_reason | TEXT | target_hit / stop_hit / manual / auto_squareoff |
| pnl | REAL | Calculated on close |
| premarket_id | INTEGER FK | Links to that day's analysis |
| report | TEXT | LLM-generated report |
| xp_earned | INTEGER | XP from this trade |

### `users`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| email | TEXT UNIQUE | Login email |
| password_hash | TEXT | bcrypt hash (passlib) |
| display_name | TEXT | Optional friendly name |
| created_at | TEXT | ISO timestamp |
| kite_user_id | TEXT | Zerodha Kite user id once linked |

### `kite_tokens`
| Column | Type | Description |
|--------|------|-------------|
| user_id | INTEGER PK | FK → `users.id` (one Kite link per user) |
| access_token | TEXT | OAuth access token from Kite |
| updated_at | TEXT | ISO timestamp of last refresh |

### `user_stats`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| user_id | INTEGER UNIQUE | FK → `users.id` |
| total_xp | INTEGER | Cumulative XP |
| streak_days | INTEGER | Consecutive active days |
| last_active | TEXT | Last trade/login date |
| virtual_balance | REAL | Starts at ₹5,00,000 |

### `daily_quests`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| date | TEXT | YYYY-MM-DD (IST) |
| phase | TEXT | One of `early` / `premarket` / `intraday` / `postmarket` / `weekend` |
| status | TEXT | `pending` / `accepted` / `completed` / `expired` |
| xp_awarded | INTEGER | XP credited to `user_stats` on completion |
| quiz_results | TEXT (JSON) | Array of `{ id, answer, correct, answered_at }` |
| total_questions | INTEGER | Default 3 |
| correct_count | INTEGER | Cached count of `quiz_results[].correct == true` |
| started_at | TEXT | ISO timestamp when row was created |
| expired_at | TEXT | ISO timestamp set when auto-expired by phase change |
| `UNIQUE(date, phase)` | | One quest per phase per day |

### `notifications`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| user_id | INTEGER FK | FK → `users.id` (indexed) |
| type | TEXT | `trade_executed`, `stop_hit`, `target_hit`, `manual_close`, `auto_squareoff`, `system_error`, `info`, `warning` |
| title | TEXT | Short digestible title |
| message | TEXT | Short digestible summary |
| details | TEXT | Full error stack trace / response payload (optional) |
| is_read | BOOLEAN | Read flag (default `false`) |
| created_at | TEXT | ISO IST timestamp |

---

## API Surface

### Analysis
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/analysis` | Get latest cached analysis |
| `POST` | `/api/analysis/run` | Trigger fresh analysis run |
| `GET` | `/api/analysis/history` | Raw premarket rows for the last `days` |
| `GET` | `/api/analysis/history-candles` | Daily pre-open OHLC plus `end_bias` on last 8:00–9:15 IST snapshot (dashboard uses `close` as end-of-window score line) |

### Option Chain & Charts
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/option-chain?symbol=NIFTY` | Nearest expiry chain (LTP/OI + % change fields from NSE) |
| `GET` | `/api/nifty-chart` | NIFTY 50 cash-index candlestick chart (returns legacy `points` + new structured `candles`) |
| `GET` | `/api/option-candles?identifier=...` | Selected NIFTY option premium 5m candlestick chart |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/notifications` | Paginated notifications (cursor `before_id`, `limit`, `unread_only`, `type_category`) |
| `GET` | `/api/notifications/{id}` | Single notification with full details |
| `POST` | `/api/notifications` | Create notification |
| `POST` | `/api/notifications/mark-read` | Mark specified IDs or all notifications as read |
| `DELETE` | `/api/notifications/clear` | Delete all read notifications for current user |

### Paper Trades
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/trades` | Open a new paper trade |
| `POST` | `/api/trades/{id}/close` | Close with exit price + reason |
| `GET` | `/api/trades/open` | All open positions |
| `GET` | `/api/trades/history` | Closed trades (last 50) |

### Reports & Stats
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/trades/{id}/report` | Generate LLM report |
| `GET` | `/api/stats` | XP, balance, win rate, streaks |

### Quests
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/quests/today` | Active quest + questions (no `correct`/`explanation`) + phase + nudge counts |
| `POST` | `/api/quests/today` | `{ status: "accepted" }` to mark intent (no XP) |
| `POST` | `/api/quests/today/answer` | `{ question_id, answer }` → validates, scores, awards XP on the last answer |
| `GET` | `/api/quests/recent?limit=5` | Last N settled quests for the success-rate dot strip |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/settings` | Get current runtime configuration (API keys masked) |
| `PUT` | `/api/settings` | Deep-merge update to `settings.json` |
| `GET` | `/api/settings/status` | Configuration status: `{ is_configured: bool, missing: list[str] }` |
| `GET` | `/api/settings/llm/status` | Health check active LLM provider |
| `POST` | `/api/settings/llm/test` | Test prompt to verify LLM connection |

### Auth (app-level)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/signup` | `{ email, password, display_name? }` → `{ token, user }` |
| `POST` | `/api/auth/login` | `{ email, password }` → `{ token, user }` |
| `GET` | `/api/auth/me` | Auth'd user + their stats (bootstraps the frontend on reload) |
| `POST` | `/api/auth/change-password` | `{ old_password, new_password }` (requires JWT) |

### Auth (Zerodha Kite, per-user link)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/kite/url` | Returns Zerodha OAuth URL (public — needed during the handshake) |
| `GET` | `/api/auth/kite/status` | Kite session health: `{ linked, authenticated, quotes_ok, detail }` |
| `POST` | `/api/auth/kite/callback` | Exchange `request_token` and persist token in `kite_tokens(user_id)` |
| `POST` | `/api/auth/kite/logout` | Clear the current user's Kite token |

All user-scoped routes (`/api/trades/*`, `/api/stats`, `/api/quests/*`) require `Authorization: Bearer <jwt>`. `/api/analysis` and `/api/analysis/run` use optional auth — they prefer the caller's Kite token for GIFT NIFTY when present, and otherwise fall back to the most-recently-updated token across all users → NSE scraping.

---

## Gamification System

### XP Rules (process over profit)
| Action | XP |
|--------|----|
| Logging a trade | +10 |
| Setting stop loss (mandatory anyway) | +20 |
| Writing a thesis | +15 |
| Reading your trade report | +10 |
| Quiz answer correct (per question, in daily quest) | +5 |
| Perfect quest bonus (all 3 correct) | +5 |
| Revenge trade penalty (trade within 5min of a loss) | −25 |
| **Profit/loss** | **0 XP** |

### Daily Quest / Quiz
- A quest holds **3 questions** drawn from a categorised bank at `backend/engine/quiz_bank.py`.
- One quest per **(date, phase)** — phases are `early`, `premarket`, `intraday`, `postmarket`, `weekend` plus the `pending_reports` / `quiz_backlog` nudges.
- Selection is deterministic via `select_questions(date, phase, user_id)` so refreshes never re-roll, and it's the swap point for Phase-2 LLM-personalised quizzes (no other code needs to change).
- **Auto-expiry**: if a higher-priority phase begins before the current quest is completed (e.g. you start a Sunday weekend quiz and Monday 9:15 hits), the in-progress quest is marked `expired` and a fresh quest for the active phase is created. Phase priority lives in `backend/engine/quest_phases.py`.
- `correct` and `explanation` are stripped from the client payload until the user submits an answer — server-side validation only.

### Badges (Achievements / process badges) — deferred

Small, discoverable badges that reward *process*, not profit — consistent
with the existing XP rules. Lives on Portfolio (out of scope for the
Analysis-page push). Earned silently (no toast spam) — discoverable in a
Portfolio grid; locked badges show greyed silhouettes with the unlock
condition. Build alongside the Portfolio revamp.

| Badge          | Criteria                                            |
|----------------|-----------------------------------------------------|
| First Thesis   | Wrote a thesis before opening your first trade      |
| Stop Respected | Closed at the original SL without moving it         |
| Consistent     | 5 consecutive trading days with XP-earning activity |
| Disciplined    | 10 trades following the original stop loss          |
| Student        | Read every mentor report for 10 closed trades       |
| Thesis Trader  | Wrote a thesis on 20 consecutive trades             |
| Quest Streak   | 5 consecutive non-expired quests                    |
| Perfect Score  | 5 quests with 100% correct                          |
| First Report   | Read your first mentor report                       |

Award triggers wire into the existing XP-award paths in
`trades/paper.py` and `trades/report.py`. Implementation sketch (DB schema,
trigger points) lives in `TECHNICAL_DETAILS.md` under "Deferred:
Achievements".

### Portfolio
- **Starting balance:** ₹5,00,000 virtual
- **Tracked stats:** Win rate, avg win, avg loss, total P&L, Sharpe ratio, max drawdown
- **Reset option:** Creates new portfolio, old data preserved for comparison

---

## LLM Report Structure

Each closed trade generates a report with:

1. **What happened** — 2-3 factual sentences
2. **Where it went right/wrong** — References pre-market context specifically
3. **What the textbook says** — Mechanical FnO education tied to this setup
4. **Verdict** — Good process / bad process, regardless of P&L outcome
5. **One thing to watch** — Single actionable sentence for next time

> [!TIP]
> The report is the core differentiator. It's why this isn't just another paper trading app. Every trade becomes a learning moment with specific, contextual feedback.

---

## Build Phases

### Phase 1 — Core Engine (current sprint)
- [x] Product plan
- [ ] Backend scaffold (FastAPI + SQLite + all modules)
- [ ] Port pre-market scoring from Google Apps Script
- [ ] yfinance data fetcher
- [ ] NSE option chain integration
- [ ] Paper trade CRUD (open/close/list)
- [ ] Frontend scaffold (React + Vite + routing)
- [ ] Dashboard page (pre-market analysis view)
- [ ] Trade page (entry form + option chain display)

### Phase 2 — Game Layer
- [ ] XP system implementation
- [ ] Streak tracking
- [ ] Portfolio stats dashboard
- [ ] Trade history view with P&L chart
- [ ] Badge system

### Phase 3 — LLM Reports
- [ ] Groq API integration
- [ ] Post-trade report generation
- [ ] Report storage and display
- [ ] Report review UI

### Phase 4 — Polish & Extend
- [ ] APScheduler for 8am auto-run
- [ ] Mobile-responsive layout
- [ ] GitHub Actions cron for data backup
- [ ] Historical score chart (Chart.js)
- [ ] Tutorial content (LLM-generated, manually reviewed)

### Phase 5 — Packaging & Open Source (Current)
- [x] Documentation infrastructure (`docs/`)
- [x] Settings UI for LLM / Provider selection
- [x] Backend config JSON file separated from `.env`
- [x] Frontend served from FastAPI statically
- [x] PyInstaller execution backend
- [x] Electron wrapper for one-click launch
- [ ] Docker Compose setup for local dev (FastAPI + React + Ollama auto-pull)
- [ ] Open source prep (README, LICENSE)

---

## Design Direction

Carrying forward from the Google Apps Script version:

- **Dark theme** — `#0c0c0d` base, `#1a1a1d` cards
- **1px borders at 8% opacity** — contained without shouting
- **12px border-radius** — modern without being bubbly
- **Inter font** — clean, professional
- **Semantic colors** — green for bullish, red for bearish, amber for warnings
- **No heavy shadows/gradients** — depth from background layering
- **Signal pills** — small colored indicators (▲ Bull / ▼ Bear)
- **Data-first hierarchy** — numbers large, labels small and muted

> [!NOTE]
> The design should feel like a professional trading terminal, not a toy. But cleaner and less overwhelming than Bloomberg/TradingView.

---

## Future Vision (6-12 months)

| Feature | Dependency |
|---------|-----------|
| Strategy modules tied to market classification | 2-3 months of logged data |
| Backtesting pre-market scores vs actual outcomes | Historical data accumulation |
| AI-personalised daily quests (swap `quiz_bank.select_questions`) | Logged trades + mentor reports for the user |
| Zerodha Kite WebSocket for live ticks | Zerodha account + Pi/always-on device |
| Cloudflare Tunnel for remote access | Any always-on device |
| Fine-tuned LLM on your trade patterns | 6+ months of trade data |
| NISM XV certification | Personal study |
| Friends / cohort leaderboards | Per-user auth shipped — UI surface is the missing piece |

### Future Gamification & Psychology Concepts
- **Disciplined Execution Scorecard (Rule Compliance Rating)**:
  - Track a player's **Disciplined Execution Rating** (% SL adherence, zero revenge trade streak, thesis quality) rather than paper profits.
  - Gamifies self-control and trading psychology over impulse gambling.
- **Dedicated Achievements Page & Profile Integration**:
  - Dedicated `/achievements` route and full-screen modal accessible from Profile / Quests (`View All Achievements`).
  - Scoped achievements strictly to user profile/quests rather than duplicating in the Learn Academy.

### Future Developer Experience & Setup Improvements
- **Zero-Touch Auto-Setup Start Script (`start.bat` / `start.sh`)**:
  - Automatically copy `.env.example` to `.env` if `.env` is missing on first run.
  - Automatically create Python `.venv` and install backend requirements if `.venv` is missing.
  - Automatically run `npm install` in `frontend/` if `node_modules` is missing.
  - Execute full setup and launch both backend and frontend in a single `start` command.

### Auth & multi-user
Tradeflow now supports multiple accounts via email + bcrypt + JWT. Every user
has their own paper-trade book, XP / streak, daily quests, and optional Kite
linkage. On first run the migrator creates a placeholder user from
`ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` (defaults `you@local` /
`tradeflow`) and backfills any pre-auth rows; **change that password
immediately** via `POST /api/auth/change-password`.
