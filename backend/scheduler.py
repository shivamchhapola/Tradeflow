"""
Tradeflow Engine — Scheduler

APScheduler jobs that run inside the FastAPI process:
  - 08:00 IST weekdays  → pre-market analysis
  - 15:15 IST weekdays  → auto EOD square-off of all open paper trades
  - Every 60s (9:15–15:15 IST weekdays) → SL/target monitoring for open trades

SL/Target is also checked on the frontend (Trade.jsx) every 15s when the
option chain refreshes during live hours. The backend job here is a safety
net that fires even when the user isn't on the Trade page.
"""

from apscheduler.schedulers.background import BackgroundScheduler
import asyncio
import logging
from datetime import datetime
import pytz
from sqlmodel import Session
from database import engine
from routes.analysis import _run_analysis_inner
from routes.trades import auto_squareoff_endpoint, monitor_sl_target_endpoint

log = logging.getLogger("tradeflow.scheduler")
IST = pytz.timezone("Asia/Kolkata")

def _scheduled_run():
    """Trigger the morning analysis directly without hitting HTTP."""
    try:
        with Session(engine) as session:
            _run_analysis_inner(session)
        log.info("Analysis run complete")
    except Exception as e:
        log.error("Scheduled run failed: %s", e)


def _auto_square_off():
    """Trigger the 3:15 PM auto square-off directly without hitting HTTP."""
    loop = asyncio.new_event_loop()
    try:
        with Session(engine) as session:
            loop.run_until_complete(auto_squareoff_endpoint(session))
        log.info("Auto square-off complete")
    except Exception as e:
        log.error("Auto square-off failed: %s", e)
    finally:
        loop.close()


def _monitor_sl_target():
    """Check open trades against live LTP and close any where SL or target is hit."""
    ist_now = datetime.now(IST)
    mins = ist_now.hour * 60 + ist_now.minute

    # Only run during market hours (9:15–15:15 IST, weekdays)
    if ist_now.weekday() >= 5:
        return
    if mins < 9 * 60 + 15 or mins >= 15 * 60 + 15:
        return

    loop = asyncio.new_event_loop()
    try:
        with Session(engine) as session:
            result = loop.run_until_complete(monitor_sl_target_endpoint(session))
            triggered = result.get("triggered", 0)
            if isinstance(triggered, int) and triggered > 0:
                log.info("SL/target monitor: %d trade(s) auto-closed", triggered)
    except Exception as e:
        log.error("SL/target monitor failed: %s", e)
    finally:
        loop.close()


def start_scheduler():
    """Start the background scheduler. Call once on app startup."""
    scheduler = BackgroundScheduler(timezone="Asia/Kolkata")
    scheduler.add_job(
        _scheduled_run,
        "cron",
        hour=8,
        minute=0,
        day_of_week="mon-fri",
        id="premarket_analysis",
        replace_existing=True,
    )
    scheduler.add_job(
        _auto_square_off,
        "cron",
        hour=15,
        minute=15,
        day_of_week="mon-fri",
        id="auto_squareoff",
        replace_existing=True,
    )
    scheduler.add_job(
        _monitor_sl_target,
        "interval",
        seconds=60,
        id="monitor_sl_target",
        replace_existing=True,
    )
    scheduler.start()
    log.info("Started — premarket at 08:00, auto square-off at 15:15, SL/target monitor every 60s (active during market hours only)")
    return scheduler

