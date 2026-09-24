"""
SkillOrbit Backend — Main Application
FastAPI server with all API routes.
"""
import sys
import os
from pathlib import Path
from datetime import datetime, timezone, timedelta
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Request, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

# Ensure backend is in path
sys.path.insert(0, str(Path(__file__).parent))

from config import (
    SESSION_SECRET, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS,
    CORS_ORIGIN, AI_PROVIDER, SUPPORTED_LANGUAGES, LANGUAGE_NAMES,
    SUPPORTED_PATHS, PATH_NAMES, HOST, PORT
)
from database import get_db, init_db, async_session_factory
from models import Learner, Session, Lesson, Attempt, Progress, SavedItem, ReviewSchedule, Project
from schemas import (
    OnboardingRequest, UpdateProfileRequest,
    TaskAttemptRequest, CheckAttemptRequest,
    SaveItemRequest, UpdateSavedItemRequest,
    SaveProjectRequest, ReviewAttemptRequest
)
from services.practice import get_provider
from services.progress import update_progress_from_attempt, get_learner_stats, schedule_review
from seed import seed_content

import hashlib
import hmac


# ── Lifespan ──

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize DB and seed content on startup."""
    await init_db()
    # Seed content
    async with async_session_factory() as db:
        stats = await seed_content(db)
        await db.commit()
        print(f"Content seeded: {stats}")
    yield


app = FastAPI(
    title="SkillOrbit API",
    description="AI Learning Platform — Local Demo",
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=[CORS_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Session Helpers ──

def _sign_session_id(session_id: str) -> str:
    """Sign a session ID with HMAC."""
    signature = hmac.new(
        SESSION_SECRET.encode(), session_id.encode(), hashlib.sha256
    ).hexdigest()[:16]
    return f"{session_id}.{signature}"


def _verify_session_cookie(cookie_value: str) -> Optional[str]:
    """Verify and extract session ID from signed cookie."""
    if not cookie_value or "." not in cookie_value:
        return None
    session_id, signature = cookie_value.rsplit(".", 1)
    expected = hmac.new(
        SESSION_SECRET.encode(), session_id.encode(), hashlib.sha256
    ).hexdigest()[:16]
    if hmac.compare_digest(signature, expected):
        return session_id
    return None


async def get_current_learner(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> tuple[Learner, AsyncSession]:
    """
    Dependency: derive learner from server-managed session cookie.
    Never trusts a client-supplied user ID.
    """
    cookie = request.cookies.get(SESSION_COOKIE_NAME)
    if not cookie:
        raise HTTPException(status_code=401, detail="No session. Please complete onboarding first.")

    session_id = _verify_session_cookie(cookie)
    if not session_id:
        raise HTTPException(status_code=401, detail="Invalid session. Please complete onboarding again.")

    result = await db.execute(
        select(Session).where(
            Session.id == session_id,
            Session.is_active == True,
            Session.expires_at > datetime.now(timezone.utc),
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=401, detail="Session expired. Please complete onboarding again.")

    result = await db.execute(
        select(Learner).where(Learner.id == session.learner_id)
    )
    learner = result.scalar_one_or_none()
    if not learner:
        raise HTTPException(status_code=401, detail="Learner not found.")

    return learner, db


# ── Health ──

@app.get("/api/health")
async def health():
    return {"status": "ok", "mode": "demo", "ai_provider": AI_PROVIDER}


# ── Onboarding ──

@app.post("/api/onboard")
async def onboard(
    req: OnboardingRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Create a guest learner and session. No signup required."""
    learner = Learner(
        display_name=req.display_name,
        language=req.language,
        active_path=req.path,
        daily_goal_minutes=req.daily_goal_minutes,
        timezone=req.timezone,
    )
    db.add(learner)
    await db.flush()

    session = Session(
        learner_id=learner.id,
        expires_at=datetime.now(timezone.utc) + timedelta(seconds=SESSION_MAX_AGE_SECONDS),
    )
    db.add(session)
    await db.flush()

    # Set signed session cookie
    signed = _sign_session_id(session.id)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=signed,
        max_age=SESSION_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        secure=False,  # False for local dev, True in production
    )

    return {
        "learner_id": learner.id,
        "display_name": learner.display_name,
        "language": learner.language,
        "path": learner.active_path,
        "daily_goal_minutes": learner.daily_goal_minutes,
        "message": (
            "Welcome to SkillOrbit! You're set up as a guest. "
            "Note: Guest access does not provide account recovery or automatic access from another device."
        ),
    }


# ── Profile ──

@app.get("/api/profile")
async def get_profile(auth: tuple = Depends(get_current_learner)):
    learner, db = auth
    stats = await get_learner_stats(db, learner.id)
    return {
        "id": learner.id,
        "display_name": learner.display_name,
        "language": learner.language,
        "active_path": learner.active_path,
        "daily_goal_minutes": learner.daily_goal_minutes,
        "timezone": learner.timezone,
        "created_at": learner.created_at.isoformat(),
        "stats": stats,
    }


@app.patch("/api/profile")
async def update_profile(
    req: UpdateProfileRequest,
    auth: tuple = Depends(get_current_learner),
):
    learner, db = auth
    if req.language is not None:
        learner.language = req.language
    if req.path is not None:
        learner.active_path = req.path
    if req.display_name is not None:
        learner.display_name = req.display_name
    if req.daily_goal_minutes is not None:
        learner.daily_goal_minutes = req.daily_goal_minutes
    if req.timezone is not None:
        learner.timezone = req.timezone
    learner.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return {"message": "Profile updated", "language": learner.language, "path": learner.active_path}


# ── Curriculum ──

@app.get("/api/curriculum")
async def get_curriculum(
    auth: tuple = Depends(get_current_learner),
):
    """Get all lessons available to the current learner's path."""
    learner, db = auth
    lang = learner.language
    path = learner.active_path

    # Get foundation + path-specific lessons
    result = await db.execute(
        select(Lesson).where(
            Lesson.is_published == True,
            Lesson.audience.in_(["shared", path]),
        ).order_by(Lesson.type, Lesson.order_index)
    )
    lessons = result.scalars().all()

    # Get learner's progress
    result = await db.execute(
        select(Progress).where(Progress.learner_id == learner.id)
    )
    progress_map = {p.lesson_id: p for p in result.scalars().all()}

    curriculum = []
    for lesson in lessons:
        content = lesson.content.get(lang, lesson.content.get("en", {}))
        prereqs_met = all(
            progress_map.get(p, None) and progress_map[p].completed
            for p in lesson.prerequisites
        )

        curriculum.append({
            "id": lesson.id,
            "type": lesson.type,
            "audience": lesson.audience,
            "version": lesson.version,
            "title": content.get("title", lesson.id),
            "description": content.get("description", ""),
            "outcome": content.get("outcome", ""),
            "estimated_duration_minutes": lesson.estimated_duration_minutes,
            "prerequisites": lesson.prerequisites,
            "prerequisites_met": prereqs_met,
            "is_locked": not prereqs_met and len(lesson.prerequisites) > 0,
            "progress": {
                "completed": progress_map.get(lesson.id, None) is not None and progress_map[lesson.id].completed,
                "total_xp": progress_map.get(lesson.id, Progress()).total_xp if progress_map.get(lesson.id) else 0,
                "attempt_count": progress_map.get(lesson.id, Progress()).attempt_count if progress_map.get(lesson.id) else 0,
                "task_passed": progress_map.get(lesson.id, Progress()).task_passed if progress_map.get(lesson.id) else False,
            },
            "translation_status": lesson.translation_status.get(lang, {"reviewed": False}),
        })

    return {
        "language": lang,
        "path": path,
        "lessons": curriculum,
    }


# ── Lesson Detail ──

@app.get("/api/lessons/{lesson_id}")
async def get_lesson(
    lesson_id: str,
    auth: tuple = Depends(get_current_learner),
):
    """Get full lesson content in the learner's language."""
    learner, db = auth
    lang = learner.language

    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    content = lesson.content.get(lang, lesson.content.get("en", {}))

    # Get learner's attempts for this lesson
    result = await db.execute(
        select(Attempt).where(
            Attempt.learner_id == learner.id,
            Attempt.lesson_id == lesson_id,
        ).order_by(Attempt.created_at.desc())
    )
    attempts = result.scalars().all()

    # Get progress
    result = await db.execute(
        select(Progress).where(
            Progress.learner_id == learner.id,
            Progress.lesson_id == lesson_id,
        )
    )
    progress = result.scalar_one_or_none()

    return {
        "id": lesson.id,
        "version": lesson.version,
        "type": lesson.type,
        "audience": lesson.audience,
        "estimated_duration_minutes": lesson.estimated_duration_minutes,
        "prerequisites": lesson.prerequisites,
        "content": content,
        "translation_status": lesson.translation_status.get(lang, {"reviewed": False}),
        "progress": {
            "completed": progress.completed if progress else False,
            "total_xp": progress.total_xp if progress else 0,
            "attempt_count": progress.attempt_count if progress else 0,
            "task_passed": progress.task_passed if progress else False,
        },
        "attempts": [
            {
                "id": a.id,
                "type": a.attempt_type,
                "user_input": a.user_input,
                "feedback": a.feedback,
                "evaluation_mode": a.evaluation_mode,
                "criteria_results": a.criteria_results,
                "xp_awarded": a.xp_awarded,
                "passed": a.passed,
                "created_at": a.created_at.isoformat(),
                "lesson_version": a.lesson_version,
            }
            for a in attempts
        ],
    }


# ── Task Attempts ──

@app.post("/api/attempts/task")
async def submit_task_attempt(
    req: TaskAttemptRequest,
    auth: tuple = Depends(get_current_learner),
):
    """Submit a task attempt. Idempotent via idempotency_key."""
    learner, db = auth

    # Check idempotency
    result = await db.execute(
        select(Attempt).where(
            Attempt.learner_id == learner.id,
            Attempt.idempotency_key == req.idempotency_key,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return {
            "attempt_id": existing.id,
            "feedback": existing.feedback,
            "criteria_results": existing.criteria_results,
            "evaluation_mode": existing.evaluation_mode,
            "xp_awarded": 0,
            "passed": existing.passed,
            "idempotent": True,
        }

    # Get lesson
    result = await db.execute(select(Lesson).where(Lesson.id == req.lesson_id))
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    lang = learner.language
    content = lesson.content.get(lang, lesson.content.get("en", {}))

    # Evaluate with practice provider
    provider = get_provider(AI_PROVIDER)
    practice_result = await provider.evaluate_task(
        req.lesson_id, req.user_input, lang, content
    )

    # Create attempt record
    attempt = Attempt(
        learner_id=learner.id,
        lesson_id=req.lesson_id,
        lesson_version=lesson.version,
        idempotency_key=req.idempotency_key,
        attempt_type="task",
        user_input={"text": req.user_input},
        feedback={"text": practice_result.feedback, "simulated_response": practice_result.simulated_response},
        evaluation_mode=practice_result.evaluation_mode,
        criteria_results=practice_result.criteria_results,
        xp_awarded=practice_result.xp_awarded,
        passed=practice_result.passed,
    )
    db.add(attempt)
    await db.flush()

    # Update progress
    progress = await update_progress_from_attempt(db, learner.id, req.lesson_id, attempt)

    return {
        "attempt_id": attempt.id,
        "feedback": attempt.feedback,
        "criteria_results": attempt.criteria_results,
        "evaluation_mode": attempt.evaluation_mode,
        "xp_awarded": attempt.xp_awarded,
        "passed": attempt.passed,
        "progress": {
            "completed": progress.completed,
            "total_xp": progress.total_xp,
            "attempt_count": progress.attempt_count,
        },
        "idempotent": False,
    }


# ── Check Attempts ──

@app.post("/api/attempts/check")
async def submit_check_attempt(
    req: CheckAttemptRequest,
    auth: tuple = Depends(get_current_learner),
):
    """Submit an understanding check answer. Idempotent."""
    learner, db = auth

    # Check idempotency
    result = await db.execute(
        select(Attempt).where(
            Attempt.learner_id == learner.id,
            Attempt.idempotency_key == req.idempotency_key,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return {
            "attempt_id": existing.id,
            "feedback": existing.feedback,
            "passed": existing.passed,
            "xp_awarded": 0,
            "idempotent": True,
        }

    # Get lesson
    result = await db.execute(select(Lesson).where(Lesson.id == req.lesson_id))
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    lang = learner.language
    content = lesson.content.get(lang, lesson.content.get("en", {}))

    provider = get_provider(AI_PROVIDER)
    practice_result = await provider.evaluate_check(
        req.lesson_id, req.check_index, req.selected_index, content
    )

    attempt = Attempt(
        learner_id=learner.id,
        lesson_id=req.lesson_id,
        lesson_version=lesson.version,
        idempotency_key=req.idempotency_key,
        attempt_type="check",
        user_input={"check_index": req.check_index, "selected_index": req.selected_index},
        feedback={"text": practice_result.feedback},
        evaluation_mode=practice_result.evaluation_mode,
        criteria_results=practice_result.criteria_results,
        xp_awarded=practice_result.xp_awarded,
        passed=practice_result.passed,
    )
    db.add(attempt)
    await db.flush()

    await update_progress_from_attempt(db, learner.id, req.lesson_id, attempt)

    return {
        "attempt_id": attempt.id,
        "feedback": attempt.feedback,
        "passed": attempt.passed,
        "xp_awarded": attempt.xp_awarded,
        "idempotent": False,
    }


# ── Progress & History ──

@app.get("/api/progress")
async def get_all_progress(auth: tuple = Depends(get_current_learner)):
    learner, db = auth
    result = await db.execute(
        select(Progress).where(Progress.learner_id == learner.id)
    )
    all_progress = result.scalars().all()
    return {
        "progress": [
            {
                "lesson_id": p.lesson_id,
                "completed": p.completed,
                "total_xp": p.total_xp,
                "attempt_count": p.attempt_count,
                "checks_passed": p.checks_passed,
                "task_passed": p.task_passed,
                "first_completed_at": p.first_completed_at.isoformat() if p.first_completed_at else None,
                "last_attempt_at": p.last_attempt_at.isoformat() if p.last_attempt_at else None,
                "best_criteria_met": p.best_criteria_met,
            }
            for p in all_progress
        ]
    }


@app.get("/api/history")
async def get_attempt_history(
    lesson_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    auth: tuple = Depends(get_current_learner),
):
    learner, db = auth
    query = select(Attempt).where(Attempt.learner_id == learner.id)
    if lesson_id:
        query = query.where(Attempt.lesson_id == lesson_id)
    query = query.order_by(Attempt.created_at.desc()).limit(limit)

    result = await db.execute(query)
    attempts = result.scalars().all()
    return {
        "attempts": [
            {
                "id": a.id,
                "lesson_id": a.lesson_id,
                "type": a.attempt_type,
                "user_input": a.user_input,
                "feedback": a.feedback,
                "evaluation_mode": a.evaluation_mode,
                "criteria_results": a.criteria_results,
                "xp_awarded": a.xp_awarded,
                "passed": a.passed,
                "created_at": a.created_at.isoformat(),
                "lesson_version": a.lesson_version,
            }
            for a in attempts
        ]
    }


# ── Saved Items ──

@app.post("/api/saved")
async def save_item(
    req: SaveItemRequest,
    auth: tuple = Depends(get_current_learner),
):
    learner, db = auth
    # Verify lesson exists
    result = await db.execute(select(Lesson).where(Lesson.id == req.lesson_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Lesson not found")

    item = SavedItem(
        learner_id=learner.id,
        lesson_id=req.lesson_id,
        item_type=req.item_type,
        label=req.label,
        note=req.note,
        highlight_text=req.highlight_text,
        language_at_save=learner.language,
    )
    db.add(item)
    await db.flush()
    return {"id": item.id, "message": "Item saved"}


@app.get("/api/saved")
async def get_saved_items(
    label: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    auth: tuple = Depends(get_current_learner),
):
    learner, db = auth
    query = select(SavedItem).where(SavedItem.learner_id == learner.id)
    if label:
        query = query.where(SavedItem.label == label)
    query = query.order_by(SavedItem.created_at.desc())

    result = await db.execute(query)
    items = result.scalars().all()

    # Client-side search filter (basic)
    if search:
        search_lower = search.lower()
        items = [i for i in items if
                 (i.note and search_lower in i.note.lower()) or
                 (i.highlight_text and search_lower in i.highlight_text.lower()) or
                 search_lower in i.lesson_id.lower()]

    return {
        "items": [
            {
                "id": i.id,
                "lesson_id": i.lesson_id,
                "item_type": i.item_type,
                "label": i.label,
                "note": i.note,
                "highlight_text": i.highlight_text,
                "language_at_save": i.language_at_save,
                "created_at": i.created_at.isoformat(),
            }
            for i in items
        ]
    }


@app.patch("/api/saved/{item_id}")
async def update_saved_item(
    item_id: str,
    req: UpdateSavedItemRequest,
    auth: tuple = Depends(get_current_learner),
):
    learner, db = auth
    result = await db.execute(
        select(SavedItem).where(
            SavedItem.id == item_id,
            SavedItem.learner_id == learner.id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Saved item not found")

    if req.label is not None:
        item.label = req.label
    if req.note is not None:
        item.note = req.note
    item.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return {"message": "Saved item updated"}


@app.delete("/api/saved/{item_id}")
async def delete_saved_item(
    item_id: str,
    auth: tuple = Depends(get_current_learner),
):
    learner, db = auth
    result = await db.execute(
        select(SavedItem).where(
            SavedItem.id == item_id,
            SavedItem.learner_id == learner.id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Saved item not found")
    await db.delete(item)
    return {"message": "Saved item removed"}


# ── Projects ──

@app.post("/api/projects")
async def save_project(
    req: SaveProjectRequest,
    auth: tuple = Depends(get_current_learner),
):
    learner, db = auth
    result = await db.execute(select(Lesson).where(Lesson.id == req.lesson_id))
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    project = Project(
        learner_id=learner.id,
        lesson_id=req.lesson_id,
        title=req.title,
        artifact_type=req.artifact_type,
        artifact_data=req.artifact_data,
        lesson_version=lesson.version,
        language=learner.language,
    )
    db.add(project)
    await db.flush()
    return {"id": project.id, "message": "Project saved"}


@app.get("/api/projects")
async def get_projects(auth: tuple = Depends(get_current_learner)):
    learner, db = auth
    result = await db.execute(
        select(Project).where(Project.learner_id == learner.id).order_by(Project.created_at.desc())
    )
    projects = result.scalars().all()
    return {
        "projects": [
            {
                "id": p.id,
                "lesson_id": p.lesson_id,
                "title": p.title,
                "artifact_type": p.artifact_type,
                "artifact_data": p.artifact_data,
                "lesson_version": p.lesson_version,
                "language": p.language,
                "created_at": p.created_at.isoformat(),
            }
            for p in projects
        ]
    }


# ── Reviews ──

@app.get("/api/reviews")
async def get_due_reviews(auth: tuple = Depends(get_current_learner)):
    learner, db = auth
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(ReviewSchedule).where(
            ReviewSchedule.learner_id == learner.id,
        ).order_by(ReviewSchedule.next_review)
    )
    schedules = result.scalars().all()
    return {
        "reviews": [
            {
                "lesson_id": r.lesson_id,
                "next_review": r.next_review.isoformat(),
                "interval_days": r.interval_days,
                "success_count": r.success_count,
                "is_due": (
                    r.next_review.replace(tzinfo=timezone.utc) <= now
                    if r.next_review.tzinfo is None
                    else r.next_review <= now
                ),
                "difficulty_rating": r.difficulty_rating,
            }
            for r in schedules
        ]
    }


@app.post("/api/reviews/complete")
async def complete_review(
    req: ReviewAttemptRequest,
    auth: tuple = Depends(get_current_learner),
):
    learner, db = auth
    schedule = await schedule_review(db, learner.id, req.lesson_id, req.difficulty_rating)
    return {
        "message": "Review recorded",
        "next_review": schedule.next_review.isoformat(),
        "interval_days": schedule.interval_days,
    }


# ── Data Export & Deletion ──

@app.get("/api/export")
async def export_data(auth: tuple = Depends(get_current_learner)):
    """Export all learner data as JSON."""
    learner, db = auth

    # Gather all data
    progress_result = await db.execute(select(Progress).where(Progress.learner_id == learner.id))
    attempts_result = await db.execute(
        select(Attempt).where(Attempt.learner_id == learner.id).order_by(Attempt.created_at)
    )
    saved_result = await db.execute(select(SavedItem).where(SavedItem.learner_id == learner.id))
    projects_result = await db.execute(select(Project).where(Project.learner_id == learner.id))
    reviews_result = await db.execute(select(ReviewSchedule).where(ReviewSchedule.learner_id == learner.id))

    return {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "learner": {
            "id": learner.id,
            "display_name": learner.display_name,
            "language": learner.language,
            "path": learner.active_path,
            "daily_goal_minutes": learner.daily_goal_minutes,
            "created_at": learner.created_at.isoformat(),
        },
        "progress": [
            {"lesson_id": p.lesson_id, "completed": p.completed, "total_xp": p.total_xp, "attempt_count": p.attempt_count}
            for p in progress_result.scalars().all()
        ],
        "attempts": [
            {
                "lesson_id": a.lesson_id, "type": a.attempt_type,
                "user_input": a.user_input, "feedback": a.feedback,
                "passed": a.passed, "xp_awarded": a.xp_awarded,
                "created_at": a.created_at.isoformat(),
            }
            for a in attempts_result.scalars().all()
        ],
        "saved_items": [
            {"lesson_id": i.lesson_id, "label": i.label, "note": i.note}
            for i in saved_result.scalars().all()
        ],
        "projects": [
            {"title": p.title, "artifact_type": p.artifact_type, "artifact_data": p.artifact_data}
            for p in projects_result.scalars().all()
        ],
        "reviews": [
            {"lesson_id": r.lesson_id, "next_review": r.next_review.isoformat(), "interval_days": r.interval_days}
            for r in reviews_result.scalars().all()
        ],
    }


@app.delete("/api/account")
async def delete_account(
    response: Response,
    auth: tuple = Depends(get_current_learner),
):
    """Delete all learner data permanently."""
    learner, db = auth
    await db.delete(learner)  # Cascades to all related records
    response.delete_cookie(SESSION_COOKIE_NAME)
    return {"message": "All your data has been deleted."}


# ── Meta ──

@app.get("/api/languages")
async def get_languages():
    return {"languages": LANGUAGE_NAMES}


@app.get("/api/paths")
async def get_paths():
    return {"paths": PATH_NAMES}


# ── Run ──

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
