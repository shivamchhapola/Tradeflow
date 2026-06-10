# Tradeflow

An interactive FnO learning platform with paper trading, pre-market analysis, and AI-powered trade reports.

## What It Does

- **Pre-market Analysis** — Scores global markets (GIFT NIFTY, NASDAQ, VIX, DXY, etc.) with weighted signals to generate a NIFTY bias score and trading playbook
- **Paper Trading** — Enter trades with stop loss, target, and thesis. Track P&L with virtual ₹5,00,000 balance
- **AI Trade Reports** — After closing a trade, an LLM generates a contextual report explaining what went right/wrong
- **Gamification** — XP for process (writing thesis, setting SL) not profit. Streaks, levels, badges

## Tech Stack

| Layer | Tool |
|-------|------|
| Backend | FastAPI (Python) |
| Frontend | React + Vite |
| Database | SQLite |
| Market Data | yfinance + NSE API |
| LLM | Groq (free tier, LLaMA 3) |
| Scheduling | APScheduler |

## Setup

### 1. Requirements
Ensure you have **Python 3.10+** and **Node.js 18+** installed.

### 2. Quick Start (Scripts) (Recommended)
You can easily start both the backend and frontend concurrently using the provided scripts:

**Windows:**
```cmd
start.bat
```

**Linux/macOS:**
```bash
./start.sh
```

### 3. Manual Setup

If you prefer to start them manually:

**Backend:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```
*Runs at http://localhost:8000*

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```
### 4. Docker

If you have Docker installed, you can spin up the entire stack seamlessly:

```bash
docker-compose up --build
```
*Frontend runs at http://localhost:5173*
*Backend runs at http://localhost:8000*

## Configuration & Data Sources

**Important:** Tradeflow does not hardcode URLs for market data scraping. 

1. Once the application is running, open the **Settings** page in the UI.
2. Refer to the [DATA_SOURCES.md](DATA_SOURCES.md) file to find the required URLs.
3. Paste the URLs into the **Data Sources** section and save.

*LLM integrations (like Groq) are also configured directly within the Settings page.*

## Usage

1. Start backend, then frontend.
2. Go to **Settings** and configure your data sources (see above).
3. Go to **Analysis** tab → click **Run Analysis** to fetch global market data and generate the playbook.
4. Go to **Trade** tab → fetch option chain, click a strike, fill in your thesis, open a paper trade.
5. Close the trade when done → go to **Reports** → generate an AI report.
6. Check **Portfolio** for stats, XP, and trade history.

## Releases and Building

Compiled desktop builds and versioned releases are published via [GitHub Releases](https://github.com/shivamchhapola/Tradeflow-v2/releases). 
To create a release, maintainers can use standard GitHub tag workflows. Check out the release page for standalone desktop installers (if available).

If you want to compile the desktop application locally, use the provided build scripts:

**Windows:**
```cmd
build.bat
```

**Linux/macOS:**
```bash
chmod +x build.sh
./build.sh
```

This will build the frontend, package the python backend via PyInstaller, and bundle them into an Electron app located in `desktop/dist/`.

## License

This project is open-source under the [MIT License](LICENSE).
