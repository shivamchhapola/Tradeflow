import os
import sys
import logging
from datetime import datetime, timezone
from sqlmodel import SQLModel, Session, create_engine, select
import platformdirs

# Import models so SQLModel metadata registry detects them
from models import User, UserStat, Achievement, UserAchievement, PaperTrade, DailyQuest, Notification

log = logging.getLogger("tradeflow.database")

MAX_NOTIFICATIONS = 10000
PRUNE_BATCH = 1000

def create_notification(
    session: Session,
    user_id: int,
    type: str,
    title: str,
    message: str,
    details: str | None = None,
) -> Notification:
    """
    Creates a notification for `user_id`.
    Maintains a maximum of 10,000 notifications per user by deleting the oldest 1,000
    when the limit is reached.
    """
    from sqlmodel import col, func, delete
    from engine.quest_phases import now_ist

    count = session.exec(
        select(func.count(col(Notification.id)))
        .where(Notification.user_id == user_id)
    ).one() or 0

    if count >= MAX_NOTIFICATIONS:
        subq = (
            select(Notification.id)
            .where(Notification.user_id == user_id)
            .order_by(col(Notification.id).asc())
            .limit(PRUNE_BATCH)
        )
        oldest_ids = list(session.exec(subq).all())
        if oldest_ids:
            session.exec(
                delete(Notification).where(col(Notification.id).in_(oldest_ids))
            )
            session.flush()

    now_iso = now_ist().isoformat()
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        details=details,
        is_read=False,
        created_at=now_iso,
    )
    session.add(notification)
    session.commit()
    session.refresh(notification)
    return notification


# Smart path resolution for SQLite database
_dev_db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tradeflow.db"))

# If running in a PyInstaller bundle, or if we want the production AppData path:
if getattr(sys, 'frozen', False) or not os.path.exists(_dev_db_path):
    # C:\Users\<user>\AppData\Local\Tradeflow\tradeflow.db
    _app_data_dir = platformdirs.user_data_dir("Tradeflow", False)
    os.makedirs(_app_data_dir, exist_ok=True)
    DB_FILE = os.path.join(_app_data_dir, "tradeflow.db")
else:
    # Use the root directory if the db is already there (local development)
    DB_FILE = _dev_db_path

DATABASE_URL = f"sqlite:///{DB_FILE}"

# SQLModel engine (allow cross-thread for FastAPI)
connect_args = {"check_same_thread": False}
engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)

def init_db():
    """Initialize the SQLModel schema. Safe to call multiple times."""
    SQLModel.metadata.create_all(engine)
    
    with Session(engine) as session:
        _bootstrap_user_if_needed(session)
        _seed_achievements(session)
        _recompute_retroactive_badges(session)
        session.commit()

def _seed_achievements(session: Session) -> None:
    badges = [
        ("first_thesis", "First Thesis", "Wrote a thesis before opening your first trade", "learning", "PenTool"),
        ("stop_respected", "Stop Respected", "Closed at the original SL without moving it", "discipline", "ShieldCheck"),
        ("consistent", "Consistent", "5 consecutive trading days with XP-earning activity", "consistency", "CalendarDays"),
        ("disciplined", "Disciplined", "10 trades following the original stop loss", "discipline", "Target"),
        ("student", "Student", "Read every mentor report for 10 closed trades", "learning", "GraduationCap"),
        ("thesis_trader", "Thesis Trader", "Wrote a thesis on 20 consecutive trades", "consistency", "BookOpenCheck"),
        ("quest_streak", "Quest Streak", "5 consecutive non-expired quests", "consistency", "Swords"),
        ("perfect_score", "Perfect Score", "5 quests with 100% correct", "learning", "Award"),
        ("first_report", "First Report", "Read your first mentor report", "learning", "ScrollText"),
    ]
    for a_id, name, desc, cat, icon in badges:
        exists = session.exec(select(Achievement).where(Achievement.id == a_id)).first()
        if not exists:
            session.add(Achievement(id=a_id, name=name, description=desc, category=cat, icon=icon))

def _recompute_retroactive_badges(session: Session) -> None:
    # We will trigger simple backfills here to avoid doing full event sourcing.
    # For now, just ensure the basic triggers will fire cleanly going forward.
    # If the user has >=1 trade with a thesis, award first_thesis.
    users = session.exec(select(User)).all()
    now_iso = datetime.now(timezone.utc).isoformat()
    
    for u in users:
        if not u.id: continue
        
        # Check first_thesis
        has_thesis = session.exec(select(PaperTrade).where(PaperTrade.user_id == u.id, PaperTrade.thesis != None, PaperTrade.thesis != "")).first()
        if has_thesis:
            _award_badge(session, u.id, "first_thesis", now_iso)
            
        # Check first_report
        has_report = session.exec(select(PaperTrade).where(PaperTrade.user_id == u.id, PaperTrade.report != None, PaperTrade.report != "")).first()
        if has_report:
            _award_badge(session, u.id, "first_report", now_iso)

def _award_badge(session: Session, user_id: int, achievement_id: str, earned_at: str) -> None:
    exists = session.exec(select(UserAchievement).where(UserAchievement.user_id == user_id, UserAchievement.achievement_id == achievement_id)).first()
    if not exists:
        session.add(UserAchievement(user_id=user_id, achievement_id=achievement_id, earned_at=earned_at))

def get_db():
    """FastAPI Dependency providing a SQLModel Session."""
    with Session(engine) as session:
        yield session

def _bootstrap_user_if_needed(session: Session) -> None:
    """
    First-run path. If `users` is empty, create a placeholder user from env vars.
    A loud warning is logged so the operator changes the password immediately.
    """
    user_exists = session.exec(select(User)).first()
    if user_exists:
        return

    try:
        from auth.security import hash_password
    except Exception as e:
        log.warning("Bootstrap user creation skipped — auth.security not importable: %s", e)
        return

    email = os.environ.get("ADMIN_BOOTSTRAP_EMAIL", "you@local")
    password = os.environ.get("ADMIN_BOOTSTRAP_PASSWORD", "tradeflow")
    display_name = os.environ.get("ADMIN_BOOTSTRAP_NAME", "You")

    log.warning(
        "Tradeflow bootstrap: creating placeholder user '%s'. "
        "Change the password immediately via POST /api/auth/change-password.",
        email,
    )

    now_iso = datetime.now(timezone.utc).isoformat()
    new_user = User(
        email=email,
        password_hash=hash_password(password),
        display_name=display_name,
        created_at=now_iso
    )
    session.add(new_user)
    session.flush()  # assigns new_user.id without committing

    new_stats = UserStat(user_id=new_user.id)
    session.add(new_stats)
    session.commit()
