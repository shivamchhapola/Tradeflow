from typing import Optional
from sqlmodel import Field, SQLModel

class User(SQLModel, table=True):
    __tablename__ = "users"  # type: ignore
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    password_hash: str
    display_name: Optional[str] = None
    created_at: str
    kite_user_id: Optional[str] = None

class PremarketLog(SQLModel, table=True):
    __tablename__ = "premarket_logs"  # type: ignore
    id: Optional[int] = Field(default=None, primary_key=True)
    date: str
    run_at: str
    score: Optional[float] = None
    bias: Optional[str] = None
    grade: Optional[str] = None
    metrics: Optional[str] = None
    market_data: Optional[str] = None
    playbook_title: Optional[str] = None
    playbook_reasoning: Optional[str] = None
    playbook_action: Optional[str] = None
    session: Optional[str] = None

class PaperTrade(SQLModel, table=True):
    __tablename__ = "paper_trades"  # type: ignore
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")
    opened_at: str
    closed_at: Optional[str] = None
    instrument: str
    direction: str
    quantity: int
    entry_price: float
    exit_price: Optional[float] = None
    stop_loss: float
    target: float
    thesis: Optional[str] = None
    exit_reason: Optional[str] = None
    pnl: Optional[float] = None
    premarket_id: Optional[int] = Field(default=None, foreign_key="premarket_logs.id")
    report: Optional[str] = None
    xp_earned: int = Field(default=0)
    thesis_score: Optional[int] = None
    process_verdict: Optional[str] = None

class UserStat(SQLModel, table=True):
    __tablename__ = "user_stats"  # type: ignore
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, unique=True, foreign_key="users.id")
    total_xp: int = Field(default=0)
    streak_days: int = Field(default=0)
    last_active: Optional[str] = None
    last_streak_day: Optional[str] = None
    virtual_balance: float = Field(default=500000.0)

class DailyQuest(SQLModel, table=True):
    __tablename__ = "daily_quests"  # type: ignore
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")
    date: str
    phase: str
    quest_text: Optional[str] = None
    status: str = Field(default="pending")
    xp_awarded: int = Field(default=0)
    quiz_answer: Optional[str] = None
    quiz_correct: Optional[bool] = None
    quiz_results: Optional[str] = None
    total_questions: int = Field(default=3)
    correct_count: int = Field(default=0)
    started_at: Optional[str] = None
    expired_at: Optional[str] = None

class Achievement(SQLModel, table=True):
    __tablename__ = "achievements"  # type: ignore
    id: str = Field(primary_key=True)
    name: str
    description: str
    category: Optional[str] = None
    icon: Optional[str] = None

class UserAchievement(SQLModel, table=True):
    __tablename__ = "user_achievements"  # type: ignore
    user_id: int = Field(foreign_key="users.id", primary_key=True)
    achievement_id: str = Field(foreign_key="achievements.id", primary_key=True)
    earned_at: str
