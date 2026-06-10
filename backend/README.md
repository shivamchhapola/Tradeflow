# Tradeflow Backend Architecture

This document provides a high-level overview of the Tradeflow backend, explaining how the different modules interact to power the pre-market analysis, paper trading, and gamification engines.

## Tech Stack
- **Framework**: FastAPI (Python 3.10+)
- **Database**: SQLite with SQLModel (SQLAlchemy wrapper)
- **Background Tasks**: APScheduler
- **LLM Integration**: Ollama (`qwen3.5:4b` by default)
- **External APIs**: NSE India (GIFT Nifty, Option Chains), yfinance (Global Indices)

---

## Directory Structure

```text
backend/
├── auth/          # JWT authentication, password hashing, and user dependencies
├── data/          # External API integrations (NSE fetcher, yfinance parallel fetcher)
├── engine/        # The core mathematical & quant logic (Scoring, Playbook, Quests)
├── routes/        # FastAPI endpoint controllers (thin wrappers around business logic)
├── trades/        # Paper trade CRUD, P&L calculations, and LLM mentor report generation
├── config.py      # Weights for the scoring engine, ticker symbols, and SEBI lot sizes
├── database.py    # SQLModel engine initialization and bootstrap routines
├── main.py        # FastAPI app entry point and CORS configuration
├── models.py      # Database schema definitions (SQLModel tables)
├── scheduler.py   # Background jobs (8:00 AM analysis, 3:15 PM auto square-off)
└── schemas.py     # Pydantic response models for API serialization
```

---

## Core Systems

### 1. Pre-Market Analysis Engine (`engine/`, `data/`)
The pre-market engine runs automatically at 08:00 AM IST on weekdays via `scheduler.py`.
- It fetches real-time data from 8 global markets (including GIFT Nifty via the NSE API and US/Asian indices via `yfinance`).
- The data is fetched in parallel using a `ThreadPoolExecutor` in `data/fetcher.py`.
- `engine/scoring.py` applies the directional weights defined in `config.py` to calculate a **Final Bias Score** (ranging roughly from -1.0 to 1.0).
- `engine/playbook.py` translates this raw mathematical score into a human-readable trading playbook (e.g., "Bearish Trend Day", "Bullish Reversal").

### 2. Paper Trading Engine (`trades/paper.py`)
Users execute paper trades against live NIFTY option premiums.
- **Rules**: Users must set a Stop Loss (SL) and are encouraged to write a thesis.
- **Gamification**: XP is awarded for *process*, not profit. Setting a stop loss, writing a thesis, and logging the trade all award XP. Revenge trading (opening a new trade within 5 minutes of a loss) deducts XP.
- **Monitoring**: The frontend polls open trades and hits a backend endpoint to automatically close trades if their SL or Target is hit.
- **Auto Square-Off**: `scheduler.py` automatically closes any open paper trades at 3:15 PM IST to mirror Indian broker rules.

### 3. LLM Mentor Reports (`trades/report.py`)
After a trade is closed, the user can request a mentor review.
- The backend sends the trade details, the user's thesis, and the morning's pre-market bias to a local Ollama instance.
- The LLM acts as a trading mentor, evaluating if the user followed their thesis and respected the pre-market bias.
- It returns a structured `PROCESS_VERDICT` (EXCELLENT, GOOD, NEEDS_WORK) and a `THESIS_SCORE`.

### 4. Quests and Gamification (`routes/quests.py`, `engine/quiz_bank.py`)
To encourage learning, the platform offers dynamic daily quests based on the time of day:
- **Pre-market (Before 9:15 AM)**: Focuses on analyzing overnight cues.
- **Market Hours (9:15 AM - 3:30 PM)**: Focuses on live price action and option chain concepts.
- **Post-market (After 3:30 PM)**: Focuses on reviewing trades and reading LLM mentor reports.
- XP and badges are awarded for consistency, perfect quiz scores, and disciplined trading.

---

## Database Schema (`models.py`)

- `User`: Authentication and profile details.
- `UserStat`: Tracks XP, virtual balance, and active streaks.
- `PremarketLog`: A snapshot of the 08:00 AM analysis (score, bias, metrics).
- `PaperTrade`: Individual trades, linking entry/exit prices, P&L, thesis, and the LLM report.
- `DailyQuest`: Tracks the user's progress on the daily gamified quizzes.
- `Achievement` / `UserAchievement`: The badge system definition and join table.

---

## Running Locally

1. Install dependencies: `pip install -r requirements.txt`
2. Ensure you have Ollama running locally with the specified model: `ollama run qwen3.5:4b`
3. Start the server: `uvicorn main:app --reload`
4. The API will be available at `http://127.0.0.1:8000`
5. The interactive Swagger docs will be available at `http://127.0.0.1:8000/docs`
