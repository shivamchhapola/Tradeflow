import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select, col

from database import get_db
from models import User, DailyQuest, PaperTrade, UserStat
from engine.quiz_bank import (
    QUESTIONS_PER_QUEST,
    select_questions,
    get_question_by_id,
    public_views,
)
from engine.quest_phases import (
    compute_natural_phase,
    now_ist,
)
from trades.paper import bump_activity_streak
from auth.dependencies import get_current_user

router = APIRouter(prefix="/api/quests", tags=["Quests"])

XP_PER_CORRECT = 5
PERFECT_BONUS  = 5


class QuestUpdate(BaseModel):
    status: Optional[str] = None


class QuizAnswer(BaseModel):
    question_id: str
    answer: str


def _today_ist() -> str:
    return now_ist().strftime("%Y-%m-%d")


def _serialise_quest(quest: DailyQuest | None, questions: list[dict]) -> dict:
    if not quest:
        return {}
    quiz_results = json.loads(quest.quiz_results) if quest.quiz_results else []
    return {
        "id":              quest.id,
        "date":            quest.date,
        "phase":           quest.phase,
        "status":          quest.status or "pending",
        "xp_awarded":      quest.xp_awarded or 0,
        "quiz_results":    quiz_results,
        "total_questions": quest.total_questions or len(questions),
        "correct_count":   quest.correct_count or 0,
        "started_at":      quest.started_at,
        "expired_at":      quest.expired_at,
    }


def _resolve_active_quest(
    session: Session,
    today: str,
    current_phase: str,
    user_id: int,
) -> tuple[DailyQuest, list[dict]]:
    active = session.exec(
        select(DailyQuest)
        .where(DailyQuest.date == today)
        .where(DailyQuest.user_id == user_id)
        .where(col(DailyQuest.status).in_(["pending", "accepted"]))
        .order_by(col(DailyQuest.id).desc())
    ).first()

    if active and active.phase != current_phase:
        active.status = "expired"
        active.expired_at = now_ist().isoformat()
        session.add(active)
        session.commit()
        active = None

    existing = session.exec(
        select(DailyQuest)
        .where(DailyQuest.date == today)
        .where(DailyQuest.phase == current_phase)
        .where(DailyQuest.user_id == user_id)
        .order_by(col(DailyQuest.id).desc())
    ).first()

    if existing and existing.status in ("completed", "expired"):
        questions = select_questions(
            today, current_phase, user_id=user_id,
            count=existing.total_questions or QUESTIONS_PER_QUEST,
        )
        return existing, questions

    if active and active.phase == current_phase:
        questions = select_questions(
            today, current_phase, user_id=user_id,
            count=active.total_questions or QUESTIONS_PER_QUEST,
        )
        return active, questions

    questions = select_questions(today, current_phase, user_id=user_id, count=QUESTIONS_PER_QUEST)
    
    new_quest = DailyQuest(
        user_id=user_id,
        date=today,
        phase=current_phase,
        status="pending",
        quiz_results="[]",
        total_questions=len(questions),
        correct_count=0,
        started_at=now_ist().isoformat(),
        xp_awarded=0,
    )
    session.add(new_quest)
    session.commit()
    session.refresh(new_quest)
    
    return new_quest, questions


@router.get("/today")
def get_todays_quest(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    today = _today_ist()
    natural_phase = compute_natural_phase()
    assert current_user.id is not None
    user_id = current_user.id

    pending_reports = len(session.exec(
        select(PaperTrade)
        .where(PaperTrade.user_id == user_id)
        .where(PaperTrade.closed_at != None)
        .where(PaperTrade.report == None)
    ).all())

    unanswered_quizzes = len(session.exec(
        select(DailyQuest)
        .where(DailyQuest.user_id == user_id)
        .where(DailyQuest.status == "pending")
        .where(DailyQuest.date < today)
    ).all())

    quest, questions = _resolve_active_quest(session, today, natural_phase, user_id)
    quest_payload = _serialise_quest(quest, questions)

    is_weekend = now_ist().weekday() >= 5
    display_phase = natural_phase
    if not is_weekend and pending_reports > 0 and natural_phase in ("early", "postmarket", "premarket"):
        display_phase = "pending_reports"
    elif not is_weekend and unanswered_quizzes > 0 and natural_phase in ("early", "postmarket"):
        display_phase = "quiz_backlog"

    answered_ids = {r["id"] for r in quest_payload.get("quiz_results", [])}
    current_index = next(
        (i for i, q in enumerate(questions) if q["id"] not in answered_ids),
        len(questions),
    )

    return {
        "phase":              display_phase,
        "natural_phase":      natural_phase,
        "pending_reports":    pending_reports,
        "unanswered_quizzes": unanswered_quizzes,
        "quest":              quest_payload,
        "questions":          public_views(questions),
        "current_index":      current_index,
    }


@router.post("/today")
def update_todays_quest(
    req: QuestUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    if req.status not in (None, "accepted"):
        raise HTTPException(400, "Only 'accepted' is a valid status update.")

    today = _today_ist()
    natural_phase = compute_natural_phase()

    assert current_user.id is not None
    quest, questions = _resolve_active_quest(session, today, natural_phase, current_user.id)

    if quest.status in ("completed", "expired"):
        raise HTTPException(
            409,
            f"This quest is already {quest.status}. Refresh to load the active quest.",
        )

    if req.status == "accepted":
        quest.status = "accepted"
        session.add(quest)
        session.commit()

    return {"status": "success", "quest": _serialise_quest(quest, questions)}


@router.post("/today/answer")
def answer_quest_question(
    req: QuizAnswer,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    today = _today_ist()
    natural_phase = compute_natural_phase()
    assert current_user.id is not None
    user_id = current_user.id

    quest, questions = _resolve_active_quest(session, today, natural_phase, user_id)

    if quest.status == "completed":
        raise HTTPException(409, "Today's quest for this phase is already complete.")
    if quest.status == "expired":
        raise HTTPException(409, "This quest has expired — refresh to load the active quest.")
    if quest.phase != natural_phase:
        raise HTTPException(409, "Phase has changed — refresh to load the active quest.")

    expected_ids = {q["id"] for q in questions}
    if req.question_id not in expected_ids:
        raise HTTPException(400, "Unknown question for this quest.")

    bank_q = get_question_by_id(req.question_id)
    if not bank_q:
        raise HTTPException(400, "Question not found in bank.")
    if req.answer not in bank_q["options"]:
        raise HTTPException(400, "Answer must be one of the listed options.")

    results = json.loads(quest.quiz_results or "[]")
    if any(r.get("id") == req.question_id for r in results):
        raise HTTPException(409, "This question has already been answered.")

    is_correct = req.answer == bank_q["correct"]
    results.append({
        "id":          req.question_id,
        "answer":      req.answer,
        "correct":     is_correct,
        "answered_at": now_ist().isoformat(),
    })

    correct_count = sum(1 for r in results if r.get("correct"))
    total = quest.total_questions or len(questions)
    quest_complete = len(results) >= total

    xp_awarded_total = 0
    if quest_complete:
        xp_awarded_total = correct_count * XP_PER_CORRECT
        if correct_count == total:
            xp_awarded_total += PERFECT_BONUS
            
        quest.quiz_results = json.dumps(results)
        quest.correct_count = correct_count
        quest.status = "completed"
        quest.xp_awarded = xp_awarded_total
        session.add(quest)
        
        if xp_awarded_total > 0:
            stats = session.exec(select(UserStat).where(UserStat.user_id == user_id)).first()
            if stats:
                stats.total_xp += xp_awarded_total
                session.add(stats)
            bump_activity_streak(session, user_id)
            
        session.flush()
        from database import _award_badge
        from datetime import datetime, timezone
        now_iso = datetime.now(timezone.utc).isoformat()
        
        if correct_count == total:
            perfects = session.exec(select(DailyQuest).where(DailyQuest.user_id == user_id, DailyQuest.correct_count == DailyQuest.total_questions, DailyQuest.status == "completed")).all()
            if len(perfects) >= 5:
                _award_badge(session, user_id, "perfect_score", now_iso)
                
        last_5 = session.exec(select(DailyQuest).where(DailyQuest.user_id == user_id, col(DailyQuest.status).in_(["completed", "expired"])).order_by(col(DailyQuest.id).desc()).limit(5)).all()
        if len(last_5) == 5 and all(q.status == "completed" for q in last_5):
            _award_badge(session, user_id, "quest_streak", now_iso)
    else:
        quest.quiz_results = json.dumps(results)
        quest.correct_count = correct_count
        session.add(quest)

    session.commit()

    answered_ids = {r["id"] for r in results}
    next_index = next(
        (i for i, q in enumerate(questions) if q["id"] not in answered_ids),
        None,
    )

    return {
        "correct":        is_correct,
        "correct_answer": bank_q["correct"],
        "explanation":    bank_q["explanation"],
        "correct_count":  correct_count,
        "total":          total,
        "quest_complete": quest_complete,
        "xp_awarded":     xp_awarded_total,
        "next_index":     next_index,
    }


@router.get("/recent")
def quest_history(
    limit: int = 5,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Fetch completed/expired quests."""
    assert current_user.id is not None
    limit = max(1, min(limit, 30))
    quests = session.exec(
        select(DailyQuest)
        .where(DailyQuest.user_id == current_user.id)
        .where(col(DailyQuest.status).in_(["completed", "expired"]))
        .order_by(col(DailyQuest.date).desc(), col(DailyQuest.id).desc())
        .limit(limit)
    ).all()
    
    return [
        {
            "id": q.id,
            "date": q.date,
            "phase": q.phase,
            "status": q.status,
            "total_questions": q.total_questions,
            "correct_count": q.correct_count,
            "xp_awarded": q.xp_awarded,
        }
        for q in quests
    ]
