"""
Daily pre-open aggregates for the dashboard (OHLC + end-of-window label).

Buckets by **premarket_logs.date**. Only rows whose `run_at` resolves to an IST
instant on **that same calendar date** between **08:00 and 09:15:59** IST
(inclusive of the 9:15 minute) are included.

Naive timestamps try UTC-wall and IST-wall; only readings that satisfy the
window on `row['date']` are kept. If both qualify, prefer higher pre-open
plausibility (typical 7–9:30 IST).
"""

from __future__ import annotations

import logging
import re
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from typing import Any

import pytz

logger = logging.getLogger(__name__)

IST = pytz.timezone("Asia/Kolkata")
UTC = pytz.UTC

# 08:00:00 .. 09:15:59.x IST (minute 9:15 fully included; 9:16 excluded)
_MORNING_START_MINS = 8 * 60
_MORNING_END_MINS = 9 * 60 + 16  # exclusive upper bound → through 09:15:59

_TIME_ONLY = re.compile(r"^(\d{1,2}):(\d{2})(?::(\d{2}))?$")


def _preopen_plausibility(ist_dt: datetime) -> float:
    t = ist_dt.astimezone(IST)
    h = t.hour + t.minute / 60.0
    if 7 <= h <= 10:
        return 3.0
    if 5 <= h < 7 or 10 < h <= 12:
        return 2.0
    if 0 <= h < 5 or 12 < h < 15:
        return 1.0
    return 0.0


def _parse_iso_datetime(s: str) -> datetime:
    s = s.strip().replace(" ", "T")
    if s.endswith("Z"):
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        if "." in s and "T" in s:
            return datetime.fromisoformat(s.split(".", 1)[0])
        raise


def _in_morning_preopen_ist(ist_dt: datetime, row_d: date) -> bool:
    """IST clock on row_d between 08:00 inclusive and 09:16 exclusive."""
    t = ist_dt.astimezone(IST)
    if t.date() != row_d:
        return False
    mins = t.hour * 60 + t.minute + t.second / 60.0
    return _MORNING_START_MINS <= mins < _MORNING_END_MINS


def _instant_for_preopen_naive(naive: datetime, row_d: date) -> datetime | None:
    """Pick UTC vs IST naive reading that lands on row_d in the morning window."""
    local_ist = IST.localize(naive)
    from_utc = UTC.localize(naive).astimezone(IST)
    ok_l = _in_morning_preopen_ist(local_ist, row_d)
    ok_u = _in_morning_preopen_ist(from_utc, row_d)
    if ok_u and not ok_l:
        return from_utc
    if ok_l and not ok_u:
        return local_ist
    if ok_l and ok_u:
        if _preopen_plausibility(from_utc) > _preopen_plausibility(local_ist):
            return from_utc
        return local_ist
    return None


def resolve_preopen_instant(row: dict[str, Any]) -> datetime | None:
    """
    IST instant for this row if it falls in the 08:00–09:15 IST window on row['date'].
    """
    raw = row.get("run_at")
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", errors="replace")
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        return None

    run_at = str(raw).strip()
    row_d = date.fromisoformat(str(row["date"]))

    m = _TIME_ONLY.match(run_at)
    if m:
        hh, mm = int(m.group(1)), int(m.group(2))
        ss = int(m.group(3)) if m.group(3) is not None else 0
        ist = IST.localize(datetime.combine(row_d, time(hh, mm, ss)))
        return ist if _in_morning_preopen_ist(ist, row_d) else None

    run_at = run_at.replace(" ", "T")
    dt = _parse_iso_datetime(run_at)
    if dt.tzinfo is not None:
        ist = dt.astimezone(IST)
        return ist if _in_morning_preopen_ist(ist, row_d) else None

    return _instant_for_preopen_naive(dt, row_d)


def _empty_candle(date_str: str) -> dict[str, Any]:
    return {
        "date": date_str,
        "open": None,
        "high": None,
        "low": None,
        "close": None,
        "sample_count": 0,
        "last_run_at": None,
        "end_bias": None,
    }


def build_preopen_daily_candles(rows: list[dict[str, Any]], num_days: int = 5) -> list[dict[str, Any]]:
    """
    Aggregate OHLC per premarket_logs.date using 08:00–09:15 IST snapshots only.
    Returns the last `num_days` available dates in the dataset (i.e. trading days).
    """
    num_days = max(1, min(num_days, 30))

    by_date: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in rows:
        d = r.get("date")
        if not d:
            continue
        by_date[str(d)].append(r)

    valid_dates_data = {}
    for ds, logs in by_date.items():
        pre_logs: list[tuple[datetime, dict[str, Any]]] = []
        for r in logs:
            inst = resolve_preopen_instant(r)
            if inst is None:
                continue
            pre_logs.append((inst, r))
        pre_logs.sort(key=lambda x: x[0])

        if not pre_logs:
            continue

        scored: list[tuple[float, dict[str, Any]]] = []
        for _, r in pre_logs:
            sc = r.get("score")
            if sc is None:
                continue
            try:
                scored.append((float(sc), r))
            except (TypeError, ValueError):
                pass
        
        if not scored:
            continue

        scores = [s for s, _ in scored]
        last_row = scored[-1][1]
        valid_dates_data[ds] = {
            "date": ds,
            "open": scores[0],
            "high": max(scores),
            "low": min(scores),
            "close": scores[-1],
            "sample_count": len(scores),
            "last_run_at": last_row.get("run_at"),
            "end_bias": last_row.get("bias"),
        }

    # Sort available dates descending, take the top N, then sort ascending for the chart
    sorted_dates = sorted(valid_dates_data.keys(), reverse=True)[:num_days]
    sorted_dates.reverse()

    out = [valid_dates_data[d] for d in sorted_dates]
    return out
