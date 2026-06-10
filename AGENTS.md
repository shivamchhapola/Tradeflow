# Tradeflow — Claude Instructions

## What This Project Is
An FnO paper trading + education platform for Indian markets (NSE/NIFTY).
Single user. Not a trading bot. The LLM explains trade outcomes — it does not generate signals.
Stack: FastAPI (Python) backend, React + Vite frontend, SQLite, Groq API for LLM reports.

---

## Non-Negotiable Rules

### Before Making Any Change
- **MANDATORY**: Read `product_plan.md` and `TECHNICAL_DETAILS.md` first to understand the architecture, goals, and technical implementation.
- **MANDATORY**: If you make any architectural, endpoint, or logic changes, you MUST update `TECHNICAL_DETAILS.md` and `product_plan.md` to keep documentation accurate.
- Read the relevant file first. Do not rewrite something you haven't read.
- If something is unclear or a dependency is missing, ask — do not guess and substitute.
- If you cannot do exactly what was asked, say so explicitly before writing any code.
- Never add a new dependency without mentioning it first.
- Never remove error handling to make something "simpler".
- Never use `print()` for errors — use Python `logging`.
- Before adding to a file, check its size. If you'd push it past the soft cap (400 lines source / 600 lines CSS), propose a split first. Full criteria in `.cursor/rules/modularization.mdc`.

### Data Sources — Read This Carefully

**GIFT NIFTY** (for Pre-Market Analysis) is fetched from the NSE India API, not yfinance.
- Endpoint: `https://www.nseindia.com/api/marketStatus`
- yfinance does not have GIFT Nifty. Do not attempt to fetch it from yfinance.
- Do not substitute Nifty 50 (`^NSEI` cash index) for GIFT Nifty under any circumstance.
- GIFT Nifty = SGX/GIFT City futures, trades 24hrs, reflects overnight sentiment.
- Nifty 50 = Indian cash index, only trades 9:15–3:30 IST. Completely useless for pre-market.

**NIFTY OPTION CHAIN** (for Live Trading) is fetched via NSE's derivative/option endpoints.
- Endpoint: `https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY` or `quote-derivative`
- Used *only* for tracking normal Nifty option premiums during live market hours.

**Global indices** (NASDAQ, S&P 500, Nikkei, VIX, DXY, Crude, US 10Y) are fetched via yfinance.
- The exact ticker symbols are in `backend/config.py`. Always check there first.
- Never guess or invent a ticker. If a ticker is wrong, say so and ask.

**NSE API session pattern** — NSE blocks direct requests without a prior cookie.
Always warm up the session first:
```python
session = requests.Session()
session.get("https://www.nseindia.com", headers=HEADERS, timeout=5)
# Now make the actual data call
session.get("https://www.nseindia.com/api/...", headers=HEADERS, timeout=10)
```
Never make a direct `requests.get()` to NSE endpoints — it will return 401/403.

**When any fetch fails:** raise an exception with a clear message. Never fall back silently to a different data source or return zeros.

---

## Indian Market Domain Facts
Get these right. Claude often has outdated or wrong values here.

- **NIFTY lot size: 65** (verified May 2026 — do not use 25, 50, or 75, all outdated)
- **Bank Nifty lot size: 30** (verified May 2026)
- **Finnifty lot size: 60** (verified May 2026)
- **Lot sizes change via SEBI circulars — always verify at dhan.co/nse-fno-lot-size before hardcoding any value**
- **Market hours: 9:15 AM – 3:30 PM IST, weekdays only**
- **Auto square-off time for paper trades: 3:15 PM IST** (15min before close)
- **NSE option chain expiry:** always use the nearest weekly expiry, not index [0] blindly —
  check that the expiry date is >= today before using it
- **Option chain URL:** `https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY`

---

## Scoring Logic
- Each asset has a signed weight in `backend/config.py`
- Score contribution = `changePercent * weight` (weights are already decimals, e.g. 0.40)
- Do NOT divide by 100 — the weights account for this
- Final score = sum of all contributions. Range roughly -1.0 to +1.0
- Positive = bullish, negative = bearish
- Never modify weights without being explicitly asked

---

## Tech-Specific Rules

**SQLite + FastAPI:**
- Never create a single global SQLite connection — FastAPI is async/threaded
- Every request must open its own connection via `get_db()` in `database.py` and close it after
- Use `conn.row_factory = sqlite3.Row` so rows behave like dicts

**IST Timezone:**
- Always use `pytz.timezone("Asia/Kolkata")` — never manual UTC+5:30 math
- Manual offset math breaks depending on server timezone config

**Groq API:**
- Model strings to use: `llama3-8b-8192` (fast/cheap) or `llama3-70b-8192` (better quality)
- Do not invent model names. These are the only two that are confirmed working on free tier.

**React / Frontend:**
- All API calls go through `src/api.js` — never fetch directly inside a component
- Option chain data must be fetched once on mount (useEffect with empty deps `[]`), not on every render
- UI library / design system has NOT been decided yet — ask before installing anything
- Do not write raw inline styles or invent a CSS system — wait for the design decision

---

## Project Structure
```
backend/
  config.py        ← weights + symbol map (source of truth, check before touching tickers)
  database.py      ← SQLite init + get_db() connection helper
  main.py          ← FastAPI app + all routes
  scheduler.py     ← APScheduler 8am IST cron (weekdays only)
  data/
    fetcher.py     ← yfinance for global indices only
    nse.py         ← NSE India API: GIFT Nifty + option chain
  engine/
    scoring.py     ← quant scoring (ported from Google Apps Script)
    playbook.py    ← playbook + session context
  trades/
    paper.py       ← paper trade CRUD + XP system
    report.py      ← Groq LLM report generation

frontend/
  src/
    api.js         ← all backend calls, axios instance
    pages/         ← Dashboard, Trade, Portfolio, Reports
    components/    ← reusable pieces
```

---

## API Conventions
- All backend routes prefixed `/api/`
- CORS: allow `http://localhost:5173`
- Errors: `{"detail": "..."}` with correct HTTP status codes
- Frontend: all data fetching through `src/api.js` only

---

## XP System (rewards process, not profit)
- +10 logging a trade
- +20 setting a stop loss (mandatory to enter trade anyway)
- +15 writing a thesis before entering
- +10 reading the LLM report after close
- -25 revenge trade (opening a new trade within 5 minutes of closing a loss)
- P&L outcome = 0 XP in all cases

---

## If You're Unsure
Ask before writing code. A wrong silent substitution wastes more time than one clarifying question.
State the problem and your proposed options — don't pick one unilaterally.