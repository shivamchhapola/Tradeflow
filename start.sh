#!/bin/bash
echo "Starting Tradeflow Backend..."
cd backend && source ../.venv/bin/activate && uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

echo "Starting Tradeflow Frontend..."
cd frontend && npm run dev

# If frontend is stopped, kill backend as well
kill $BACKEND_PID
