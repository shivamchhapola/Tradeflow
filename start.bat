@echo off
setlocal enabledelayedexpansion

if not exist ".env" (
    if exist ".env.example" (
        echo [.env] Creating .env from .env.example with active defaults (VITE_API_URL, NSE_BASE_URL)...
        copy ".env.example" ".env" >nul
    )
)

if not exist ".venv" (
    echo [.venv] Python virtual environment not found. Creating .venv...
    python -m venv .venv
    call .venv\Scripts\activate.bat
    echo [.venv] Installing backend requirements...
    pip install -r backend\requirements.txt
)

if not exist "frontend\node_modules" (
    echo [frontend] Installing npm packages...
    cd frontend
    call npm install
    cd ..
)

echo Starting Tradeflow Backend...
start "Tradeflow Backend" cmd /c "cd backend && call ..\.venv\Scripts\activate.bat && uvicorn main:app --reload --port 8000"

echo Starting Tradeflow Frontend...
cd frontend
npm run dev
