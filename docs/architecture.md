# Tradeflow — Architecture Reference

> **Audience**: AI agents and contributors.  
> **Rule**: Update this doc whenever you change the module map, add a dependency, or alter the data flow.

---

## System Overview

Tradeflow is a single-user FnO (Futures & Options) paper-trading + education platform for Indian markets (NSE/NIFTY). It runs entirely on the user's machine — no cloud backend.

```
┌────────────────────────────────────────────────────────────────┐
│                     User's Windows Machine                      │
│                                                                  │
│  ┌──────────────┐   HTTP    ┌────────────────────────────────┐  │
│  │   Frontend   │ ────────▶ │        Backend (FastAPI)        │  │
│  │  React/Vite  │           │        uvicorn :8000            │  │
│  │  Port 5173   │ ◀──────── │                                │  │
│  └──────────────┘           │  ┌──────────┐  ┌────────────┐ │  │
│                              │  │ Engine   │  │  Trades    │ │  │
│                              │  │ scoring  │  │  paper     │ │  │
│                              │  │ playbook │  │  report    │ │  │
│                              │  │ quests   │  │  (→ LLM)   │ │  │
│                              │  └────┬─────┘  └─────┬──────┘ │  │
│                              │       │              │        │  │
│                              │  ┌────▼──────────────▼──────┐ │  │
│                              │  │       SQLite (WAL)       │ │  │
│                              │  │    tradeflow.db          │ │  │
│                              │  └──────────────────────────┘ │  │
│                              │                                │  │
│                              │  ┌──────────────────────────┐ │  │
│                              │  │  Settings (JSON file)    │ │  │
│                              │  │  settings.json           │ │  │
│                              │  └──────────────────────────┘ │  │
│                              └────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────┐  (optional, user-started)                      │
│  │   Ollama     │  localhost:11434                                │
│  │  qwen3.5:4b  │  ← only used when LLM provider = "ollama"     │
│  └──────────────┘                                                │
│                                                                  │
│  External APIs (internet required):                              │
│    NSE India ── GIFT Nifty (pre-market) + option chain           │
│    yfinance ── global index data (NASDAQ, S&P, VIX, etc.)        │
│    Groq ────── cloud LLM (when provider = "groq")                │
└────────────────────────────────────────────────────────────────┘
```

---

## Module Map

### Backend (`backend/`)

```
backend/
├── main.py                  # FastAPI app + lifespan (init_db, scheduler)
├── config.py                # Weights, symbol map, lot sizes (static)
├── settings.py              # Runtime settings store (settings.json R/W)
├── database.py              # SQLModel engine, init_db, migrations, seeding
├── models.py                # SQLModel table definitions
├── schemas.py               # Pydantic response models
├── scheduler.py             # APScheduler (premarket 8am, squareoff 3:15pm)
│
├── auth/                    # Authentication module
│   ├── dependencies.py      # get_current_user / get_current_user_optional
│   ├── routes.py            # /api/auth/* endpoints
│   └── security.py          # bcrypt + JWT helpers
│
├── data/                    # Market data fetchers
│   ├── fetcher.py           # yfinance global indices + GIFT Nifty (NSE)
│   ├── nse.py               # NSE option chain + option premium charts
│   └── nifty_chart.py       # NSE index tracker → NIFTY 50 OHLC candles
│
├── engine/                  # Core analysis engine
│   ├── scoring.py           # Macro bias scoring (weighted sum)
│   ├── playbook.py          # Playbook/scenario generation
│   ├── quest_phases.py      # Phase detection + priority
│   └── quiz_bank.py         # Static question bank + selection logic
│
├── llm/                     # LLM provider abstraction
│   ├── __init__.py
│   ├── provider.py          # Base class + factory (get_llm_provider)
│   ├── ollama.py            # Ollama HTTP API implementation
│   └── groq.py              # Groq SDK implementation
│
├── routes/                  # API route modules
│   ├── analysis.py          # /api/analysis*
│   ├── market.py            # /api/option-chain, /api/nifty-chart, etc.
│   ├── trades.py            # /api/trades*
│   ├── reports.py           # /api/trades/{id}/report, /api/stats
│   ├── quests.py            # /api/quests*
│   └── settings.py          # /api/settings*
│
└── trades/                  # Trade business logic
    ├── paper.py             # Paper trade CRUD, XP, streaks
    └── report.py            # LLM report prompt + save logic
```

### Frontend (`frontend/src/`)

```
frontend/src/
├── main.jsx                 # React root + Toaster
├── App.jsx                  # Router + nav + auth wrapper
├── App.css                  # CSS import chain (→ styles/)
├── api.js                   # Axios instance + all API helpers
│
├── context/
│   └── AuthContext.jsx      # Auth state + JWT + /me bootstrap
│
├── hooks/
│   ├── useMarketSession.js  # IST phase detection (live/premarket/etc.)
│   ├── usePolling.js        # Visibility-aware poll helper
│   └── useStats.js          # Stats query + cache
│
├── lib/
│   ├── auth.js              # localStorage token helpers
│   └── copy.js              # All UI strings (voice-consistent)
│
├── pages/
│   ├── Dashboard.jsx        # Pre-market analysis
│   ├── Trade.jsx            # Paper trading terminal
│   ├── Portfolio.jsx        # Stats + trade history
│   ├── Reports.jsx          # LLM mentor reports
│   ├── Learn.jsx            # Educational content
│   ├── Settings.jsx         # Integration config (LLM, data sources)
│   ├── Login.jsx
│   └── Signup.jsx
│
├── components/
│   ├── layout/              # Nav, BottomNav, RouteFallback
│   ├── dashboard/           # ScoreCard, MarketTable, PlaybookCard, etc.
│   ├── trade/               # OptionChain, TradeTicket, OpenPositions
│   ├── portfolio/           # StatsGrid, TradeHistory, EquityCurve
│   ├── reports/             # ReportCard, etc.
│   └── ui/                  # Pill, ErrorBoundary, generic primitives
│
└── styles/
    ├── tokens.css           # Design tokens (colors, spacing, radii)
    ├── layout.css           # Nav, grid, page structure
    ├── buttons.css          # Button variants
    ├── cards.css            # Card primitives
    ├── forms.css            # Input, select, checkbox styles
    ├── states.css           # Loading, empty, error states
    ├── settings.css         # Settings page styles
    ├── dashboard.css
    ├── trade*.css           # Trade module (chain, chart, ticket, positions)
    ├── portfolio.css
    ├── reports*.css
    └── learn.css
```

---

## Data Flow

### Pre-Market Analysis (8:00 AM IST → Dashboard)

```
APScheduler cron 8:00 IST
  → POST /api/analysis/run
    → fetcher.fetch_market_data()
      → NSE /api/marketStatus → GIFT Nifty % change
      → yfinance batch → 7 global indices % change
    → scoring.score_market(data) → bias score, bias label, grade
    → playbook.generate(score, data) → scenarios, warnings
    → INSERT INTO premarket_logs
    → return full analysis payload
```

### Paper Trade Lifecycle

```
User opens trade (POST /api/trades)
  → validates instrument, SL, target
  → checks revenge trade (last loss < 5min ago → -25 XP)
  → awards XP (trade: +10, SL: +20, thesis: +15)
  → INSERT INTO paper_trades

Trade closes (POST /api/trades/{id}/close or auto-squareoff)
  → calculates P&L
  → updates virtual_balance
  → bumps activity streak (unless auto_squareoff)
  → UPDATE paper_trades

Report generated (POST /api/trades/{id}/report)
  → LLM provider (Ollama or Groq) generates report
  → extracts thesis_score + process_verdict
  → awards +10 XP for reading
  → checks badge triggers
  → UPDATE paper_trades.report
```

### LLM Provider Flow

```
settings.json → llm.provider = "ollama" | "groq"
  → get_llm_provider() reads settings at call time
  → OllamaProvider: HTTP POST to localhost:11434/api/generate
  → GroqProvider: groq SDK → api.groq.com
  → Both return: (report_text, thesis_score, process_verdict)
```

---

## Key Constraints

1. **Single-user, local-first** — no cloud deployment, no multi-tenant concerns
2. **SQLite WAL mode** — sufficient for years of single-user data
3. **IST timezone** — all market logic uses `pytz.timezone("Asia/Kolkata")`
4. **NSE session warmup** — every NSE API call must warm cookies first
5. **Settings are runtime-mutable** — stored in `settings.json`, not `.env`
6. **No Docker required** — runs directly on Windows with Python + Node
