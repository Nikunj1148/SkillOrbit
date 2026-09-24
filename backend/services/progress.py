"""
SkillOrbit Backend — Progress Service
Handles XP calculation, completion tracking, and idempotent updates.
"""
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models import Progress, Attempt, ReviewSchedule
from config import (
    XP_LESSON_COMPLETE, XP_CHECK_CORRECT, XP_TASK_PASS,
    XP_FIRST_ATTEMPT_BONUS, REVIEW_INTERVALS
)


async def get_or_create_progress(
    db: AsyncSession, learner_id: str, lesson_id: str
) -> Progress:
    """Get existing progress or create a new record."""
    result = await db.execute(
        select(Progress).where(
            Progress.learner_id == learner_id,
            Progress.lesson_id == lesson_id,
        )
    )
    progress = result.scalar_one_or_none()

    if not progress:
        progress = Progress(
            learner_id=learner_id,
            lesson_id=lesson_id,
        )
        db.add(progress)
        await db.flush()

    return progress


async def update_progress_from_attempt(
    db: AsyncSession,
    learner_id: str,
    lesson_id: str,
    attempt: Attempt,
) -> Progress:
    """
    Update progress based on a new attempt. Idempotent — checks if
    this attempt was already counted.
    """
    progress = await get_or_create_progress(db, learner_id, lesson_id)

    # The attempt's XP was already set by the practice service
    # We just accumulate it in progress
    progress.attempt_count += 1
    progress.total_xp += attempt.xp_awarded
    progress.last_attempt_at = attempt.created_at

    if attempt.attempt_type == "check" and attempt.passed:
        progress.checks_passed += 1

    if attempt.attempt_type == "task" and attempt.passed and not progress.task_passed:
        progress.task_passed = True
        # First-time task completion bonus
        if progress.attempt_count == 1:
            bonus = XP_FIRST_ATTEMPT_BONUS
            attempt.xp_awarded += bonus
            progress.total_xp += bonus

    # Count criteria met
    if attempt.criteria_results:
        met = sum(1 for c in attempt.criteria_results if c.get("met", False))
        if met > progress.best_criteria_met:
            progress.best_criteria_met = met

    # Check if lesson is now complete (task passed + checks done)
    if progress.task_passed and not progress.completed:
        progress.completed = True
        progress.first_completed_at = datetime.now(timezone.utc)
        progress.total_xp += XP_LESSON_COMPLETE

        # Schedule first review
        await schedule_review(db, learner_id, lesson_id)

    await db.flush()
    return progress


async def schedule_review(
    db: AsyncSession,
    learner_id: str,
    lesson_id: str,
    difficulty: int | None = None,
) -> ReviewSchedule:
    """Schedule or update spaced repetition review."""
    result = await db.execute(
        select(ReviewSchedule).where(
            ReviewSchedule.learner_id == learner_id,
            ReviewSchedule.lesson_id == lesson_id,
        )
    )
    schedule = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)

    if not schedule:
        schedule = ReviewSchedule(
            learner_id=learner_id,
            lesson_id=lesson_id,
            next_review=now + timedelta(days=REVIEW_INTERVALS[0]),
            interval_days=REVIEW_INTERVALS[0],
            success_count=0,
        )
        db.add(schedule)
    else:
        # Advance to next interval on success
        current_idx = REVIEW_INTERVALS.index(schedule.interval_days) if schedule.interval_days in REVIEW_INTERVALS else 0
        if difficulty and difficulty >= 4:
            # Difficult — reset to shorter interval
            next_idx = max(0, current_idx - 1)
        else:
            next_idx = min(len(REVIEW_INTERVALS) - 1, current_idx + 1)

        schedule.interval_days = REVIEW_INTERVALS[next_idx]
        schedule.next_review = now + timedelta(days=schedule.interval_days)
        schedule.success_count += 1
        schedule.last_reviewed_at = now
        if difficulty:
            schedule.difficulty_rating = difficulty

    await db.flush()
    return schedule


async def get_learner_stats(db: AsyncSession, learner_id: str) -> dict:
    """Get aggregated learner statistics."""
    # Get all progress records
    result = await db.execute(
        select(Progress).where(Progress.learner_id == learner_id)
    )
    all_progress = result.scalars().all()

    # Get all attempts for active days calculation
    result = await db.execute(
        select(Attempt.created_at).where(Attempt.learner_id == learner_id)
    )
    attempt_dates = result.scalars().all()
    active_days = len(set(d.date() for d in attempt_dates)) if attempt_dates else 0

    # Get due reviews
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(ReviewSchedule).where(
            ReviewSchedule.learner_id == learner_id,
            ReviewSchedule.next_review <= now,
        )
    )
    due_reviews = result.scalars().all()

    total_xp = sum(p.total_xp for p in all_progress)
    completed = sum(1 for p in all_progress if p.completed)
    total_attempts = sum(p.attempt_count for p in all_progress)

    return {
        "total_xp": total_xp,
        "lessons_completed": completed,
        "total_attempts": total_attempts,
        "active_days": active_days,
        "due_reviews": len(due_reviews),
        "due_review_lessons": [r.lesson_id for r in due_reviews],
        "evidence_note": (
            f"Based on {total_attempts} attempts across {completed} lessons over {active_days} active days. "
            "Rule-based evaluation provides limited evidence — not validated mastery."
            if total_attempts > 0
            else "Not enough evidence yet. Complete some lessons to see your growth."
        ),
    }
