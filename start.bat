@echo off
echo Starting Tradeflow Backend...
start "Tradeflow Backend" cmd /c "cd backend && call ..\.venv\Scripts\activate.bat && uvicorn main:app --reload --port 8000"

echo Starting Tradeflow Frontend...
cd frontend
npm run dev
