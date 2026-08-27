#!/bin/bash

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "[.env] Creating .env from .env.example with active defaults (VITE_API_URL, NSE_BASE_URL)..."
        cp .env.example .env
    fi
fi

if [ ! -d ".venv" ]; then
    echo "[.venv] Python virtual environment not found. Creating .venv..."
    python3 -m venv .venv
    source .venv/bin/activate
    echo "[.venv] Installing backend requirements..."
    pip install -r backend/requirements.txt
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "[frontend] Installing npm packages..."
    (cd frontend && npm install)
fi

echo "Starting Tradeflow Backend..."
cd backend && source ../.venv/bin/activate && uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

echo "Starting Tradeflow Frontend..."
cd frontend && npm run dev

# If frontend is stopped, kill backend as well
kill $BACKEND_PID
