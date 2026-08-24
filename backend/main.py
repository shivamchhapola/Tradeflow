"""
Tradeflow Engine — FastAPI Application

Main entry point. Exposes all API endpoints for:
  - Pre-market analysis (run + fetch)
  - Option chain data
  - Paper trade CRUD
  - LLM trade reports
  - User stats (XP, balance, win rate)
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from dotenv import load_dotenv

from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend

load_dotenv()

from database import init_db
from scheduler import start_scheduler

# Routers
from auth.routes import router as auth_router
from routes.market import router as market_router
from routes.analysis import router as analysis_router
from routes.trades import router as trades_router
from routes.quests import router as quests_router
from routes.reports import router as reports_router
from routes.settings import router as settings_router
from routes.notifications import router as notifications_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize DB and scheduler on startup."""
    init_db()
    FastAPICache.init(InMemoryBackend(), prefix="fastapi-cache")
    scheduler = start_scheduler()
    yield
    scheduler.shutdown()


app = FastAPI(
    title="Tradeflow Engine",
    description="FnO learning platform with paper trading and LLM feedback",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include all modular routers
app.include_router(auth_router)
app.include_router(market_router)
app.include_router(analysis_router)
app.include_router(trades_router)
app.include_router(quests_router)
app.include_router(reports_router)
app.include_router(settings_router)
app.include_router(notifications_router)


# Serve Frontend Static Files
import sys
if getattr(sys, 'frozen', False):
    # PyInstaller execution
    FRONTEND_DIST = os.path.join(sys._MEIPASS, "frontend", "dist")
else:
    # Local dev execution
    FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))

if os.path.isdir(FRONTEND_DIST):
    # Serve Vite assets
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")
    
    # Optional: Serve other static files in dist root (like favicon.ico) if needed
    @app.get("/{file_path:path}")
    async def serve_static(file_path: str, request: Request):
        if file_path.startswith("api/"):
            # Let FastAPI handle /api routes and 404 naturally
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="API route not found")
        
        # If it's a file request that exists in dist, serve it
        full_path = os.path.join(FRONTEND_DIST, file_path)
        if os.path.isfile(full_path):
            return FileResponse(full_path)
            
        # Otherwise, fallback to index.html (SPA routing)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
else:
    @app.get("/")
    def no_frontend():
        return {"message": "Frontend not built. Run `npm run build` in frontend/."}
