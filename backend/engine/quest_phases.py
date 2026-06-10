"""
Tradeflow — Quest Phase Resolver

Computes the current quest phase from IST wall-clock time, and provides a
priority ranking used to auto-expire stale quests when a higher-priority
phase begins.

Phases (lower priority number = higher priority):
    1. pending_reports — unread mentor reports nudge (weekdays only)
    2. intraday        — 9:15–15:30 IST weekday (most valuable learning slot)
    3. postmarket      — 15:30+ IST weekday
    4. premarket       — 9:00–9:15 IST weekday
    5. early           — before 9:00 IST weekday
    6. weekend         — Saturday & Sunday all day
    7. quiz_backlog    — older unanswered quizzes

Note: `pending_reports` and `quiz_backlog` are *nudge* phases — they override
the natural phase in the API response but don't represent independent quest
rows in the DB. Quest rows always carry the natural phase
(early/premarket/intraday/postmarket/weekend).
"""

from __future__ import annotations

from datetime import datetime, timedelta
import pytz

IST = pytz.timezone("Asia/Kolkata")

PHASE_PRIORITY: dict[str, int] = {
    "pending_reports": 1,
    "intraday":        2,
    "postmarket":      3,
    "premarket":       4,
    "early":           5,
    "weekend":         6,
    "quiz_backlog":    7,
}

NATURAL_PHASES = ("early", "premarket", "intraday", "postmarket", "weekend")


def now_ist() -> datetime:
    return datetime.now(IST)


def compute_natural_phase(now: datetime | None = None) -> str:
    """The phase implied purely by current IST wall-clock time."""
    n = (now or now_ist()).astimezone(IST)
    if n.weekday() >= 5:
        return "weekend"
    time_val = n.hour + n.minute / 60.0
    if time_val < 9.0:
        return "early"
    if time_val < 9.25:
        return "premarket"
    if time_val < 15.5:
        return "intraday"
    return "postmarket"


def phase_priority(phase: str) -> int:
    """Lower number = higher priority. Unknown phases sort to the bottom."""
    return PHASE_PRIORITY.get(phase, 99)


def is_higher_priority(current: str, candidate: str) -> bool:
    """True iff `candidate` outranks `current` (i.e. has a lower priority number)."""
    return phase_priority(candidate) < phase_priority(current)


def next_phase_boundary(phase: str, now: datetime | None = None) -> datetime:
    """
    Return the IST datetime at which this phase ends and the next one begins.

    Used by the frontend countdown timer — it's also useful server-side as a
    sanity check that an expired quest's phase boundary has indeed passed.
    """
    n = (now or now_ist()).astimezone(IST)
    today_9    = n.replace(hour=9,  minute=0,  second=0, microsecond=0)
    today_915  = n.replace(hour=9,  minute=15, second=0, microsecond=0)
    today_1530 = n.replace(hour=15, minute=30, second=0, microsecond=0)
    tomorrow_midnight = (n + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)

    if phase == "early":
        return today_9
    if phase == "premarket":
        return today_915
    if phase == "intraday":
        return today_1530
    if phase == "postmarket":
        return tomorrow_midnight
    if phase == "weekend":
        # Boundary = Monday 9:00 IST
        days_until_monday = (7 - n.weekday()) % 7 or 7
        if n.weekday() == 5:        # Saturday
            days_until_monday = 2
        elif n.weekday() == 6:      # Sunday
            days_until_monday = 1
        monday = (n + timedelta(days=days_until_monday)).replace(
            hour=9, minute=0, second=0, microsecond=0
        )
        return monday
    # Nudge phases inherit the underlying natural phase boundary.
    return next_phase_boundary(compute_natural_phase(n), n)
