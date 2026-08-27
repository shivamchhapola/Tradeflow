# Tradeflow — Product & Technical Summary

## 📌 Executive Overview

**Tradeflow** is an FnO (Futures & Options) paper trading and contextual education platform for Indian financial markets (NSE / NIFTY). It bridges real-time market data with interactive learning, guiding retail traders through structured market phases, disciplined trade execution, and AI-powered post-trade mentor reviews.

> [!IMPORTANT]
> **Tradeflow is an educational platform, not a signal generator or trading bot.** It rewards process over profit (+20 XP for setting stop losses, +15 XP for thesis writing, -25 XP penalty for revenge trading).

---

## 🎯 Core Product Mechanics

### 1. 🌅 Morning Pre-Market Scoring & Playbook (8:00 AM IST)
- **Automatic Cron**: APScheduler executes every weekday at 8:00 AM IST.
- **Data Integration**: Fetches GIFT Nifty via NSE India API and global indices (NASDAQ, S&P 500, Nikkei, VIX, DXY, Crude, US 10Y) via Yahoo Finance proxy.
- **Quant Engine**: Calculates a signed market score ($\approx -1.0 \text{ to } +1.0$) and generates a directional bias (*Macro-Aligned Bullish / Bearish*) with trade playbook guidance.

### 2. 📈 Live Paper Trading & Option Chain
- **Option Chain**: Real-time Nifty 50 option chain with LTPs, IV, and strike selections.
- **Mandatory Risk Controls**: Trade entries require mandatory **Stop-Loss (SL)** and **Take-Profit (Target)** levels.
- **Thesis Bonus**: Logging a trade thesis ($\ge 30$ characters) awards **+15 XP**.
- **Auto Square-Off**: Open positions are automatically closed at 3:15 PM IST (15 minutes prior to market close).

### 3. 🤖 AI Mentor Post-Trade Reviews
- **Provider Integrations**: Supports **Groq API** (`llama-3.1-8b-instant`) and local **Ollama** (`qwen3.5:4b`).
- **Customizable Personas**:
  - 🤝 **Supportive Coach**: Encouraging and growth-oriented.
  - 🛡️ **Strict Risk Manager**: Zero-tolerance for discipline slips or SL moves.
  - 📚 **Textbook Educator**: Deep theoretical analysis of Greeks, IV, and technical structure.
- **Dynamic Config**: Adjustable temperature (`0.0`–`1.0`), max tokens (`200`–`2000`), and base URLs.

### 4. 🎮 Daily Quests & Gamified Progression
- **Phase-Aware Market Drills**: Daily quests adapt based on wall-clock IST time:
  - `early` (00:00–09:00 IST) — Pre-open warmups.
  - `premarket` (09:00–09:15 IST) — Global cue alignment.
  - `intraday` (09:15–15:30 IST) — Live session reflex drills.
  - `postmarket` (15:30–23:59 IST) — Evening trade reviews.
  - `weekend` (Saturday & Sunday) — Greeks, strategies & NSE rules.
- **Auto-Refresh Boundary**: Quest card automatically reloads when countdown reaches `00:00`.
- **Level & Rank Progression**: 500 XP per level with unlocked rank titles:
  - *Level 1*: Novice Trader
  - *Level 2*: F&O Apprentice
  - *Level 3*: Options Practitioner
  - *Level 4*: Volatility Specialist
  - *Level 5*: Derivatives Analyst
  - *Level 6*: Market Strategist
  - *Level 7+*: Master Trader
- **Achievements Matrix**: Showcase on `/learn` tracking milestone badges (*First Thesis*, *Stop Respected*, *Consistent Trader*, *Clean Run*, *Quest Streak*, *Academy Scholar*).

---

## 🏗️ Technical Architecture

```
[ Frontend: React 18 + Vite ]
       │
       ├── Axios API Client (src/api.js) + JWT Auth
       ├── SetupGuard & UnsavedChangesContext Interceptor
       └── Dynamic Polling (option_chain_interval & chart_interval)
       │
       ▼ (HTTP / REST)
[ Backend: FastAPI (Python 3.10+) ]
       │
       ├── settings.py — Runtime JSON config with atomic writes
       ├── data/ — NSE Session & Yahoo Finance Fetchers
       ├── engine/ — Quant Scoring, Playbook, Phase Resolver, Quiz Bank
       ├── trades/ — Paper Trade Execution & Groq/Ollama Report Generator
       └── database.py — SQLite + SQLModel ORM (get_db per-request session)
```

### 1. Backend Stack & Storage
- **FastAPI**: Async Python framework exposing `/api/` REST endpoints with CORS support.
- **SQLite + SQLModel**: Thread-safe database access via per-request `Session` helper (`get_db()`).
- **Settings Store (`backend/settings.py`)**: File-based `settings.json` (root or AppData) featuring:
  - Deep-merge updates and `_validate` input clamping.
  - Atomic writes (`_write_atomic` via temp file rename).
  - Configurable `nse_base_url`, `yfinance_base_url`, and `groq_base_url`.
  - Automatic `invalidate_nse_session()` on URL updates.

### 2. Market Data & NSE Session Protocol
- **NSE Session Warmup (`backend/data/nse_session.py`)**: Warmup GET request to `https://www.nseindia.com` to capture cookies before invoking derivative endpoints.
- **Global Indices Fetcher (`backend/data/fetcher.py`)**: Yahoo Finance chart API (`/v8/finance/chart/{symbol}`) with fallback to `yf.Ticker`.
- **Dynamic Polling & Timeouts**: User-configured request timeout (`3s`–`60s`) and polling intervals (`15s`–`300s`).

### 3. Frontend Design & Security
- **React 18 + Vite**: SPA with React Router DOM navigation.
- **Vanilla CSS Tokens**: Sleek dark design system (`#0c0c0d` background, `#1a1a1d` cards, HSL color tokens).
- **Navigation Protection**:
  - `SetupGuard`: Enforces mandatory setup while granting `/learn` path exemption.
  - `UnsavedChangesContext`: Intercepts link clicks when settings are dirty, prompting users with **Save & Continue**, **Discard & Leave**, or **Stay on page**.
  - `SetupWarningBanner`: Persistent top warning banner when data sources are unconfigured.
  - `AchievementsGrid`: Interactive badge progress showcase on the Learn page.

---

## 🛠️ Configuration & API Endpoints

| Category | Endpoint | Method | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `/api/auth/login` | POST | Authenticates user & returns JWT token |
| **Auth** | `/api/auth/me` | GET | Returns current user profile & stats |
| **Settings** | `/api/settings` | GET / PUT | Reads or partial-updates runtime settings |
| **Settings** | `/api/settings/status` | GET | Checks setup configuration state |
| **Settings** | `/api/settings/data-sources/test` | POST | Connection tester for NSE & Yahoo Finance base URLs |
| **Settings** | `/api/settings/reset` | POST | Restores factory default settings |
| **Quests** | `/api/quests/today` | GET | Resolves current phase quest & questions |
| **Quests** | `/api/quests/today/answer` | POST | Submits quiz answer & awards XP |
| **Trades** | `/api/trades` | GET / POST | Fetches open trades or executes a paper trade |
| **Trades** | `/api/trades/{id}/close` | POST | Closes trade position & triggers LLM report |

---

## 📜 Key Configuration File (`settings.json` Schema)

```json
{
  "llm": {
    "provider": "groq",
    "ollama_base_url": "http://localhost:11434",
    "ollama_model": "qwen3.5:4b",
    "groq_api_key": "gsk_...",
    "groq_base_url": "https://api.groq.com/openai/v1",
    "groq_model": "llama-3.1-8b-instant",
    "mentor_persona": "supportive",
    "temperature": 0.7,
    "max_tokens": 600
  },
  "data_sources": {
    "option_chain": "nse",
    "gift_nifty": "nse",
    "nse_base_url": "https://www.nseindia.com",
    "global_indices": "yfinance",
    "yfinance_base_url": "https://query1.finance.yahoo.com",
    "option_chain_interval": 60,
    "chart_interval": 60,
    "request_timeout": 10
  },
  "general": {
    "auto_squareoff_time": "15:15",
    "premarket_cron_time": "08:00"
  }
}
```

---

## 🚀 Roadmap & Setup Enhancements

- **Zero-Touch Auto-Setup Start Script (`start.bat` / `start.sh`)**:
  - Automatically copy `.env.example` to `.env` if `.env` is missing on first run.
  - Automatically create Python `.venv` and install backend requirements if `.venv` is missing.
  - Automatically run `npm install` in `frontend/` if `node_modules` is missing.
  - Execute full setup and launch both backend and frontend in a single `start` command.
