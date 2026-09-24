"""
SkillOrbit Backend — Database Models
SQLAlchemy models for all persistent entities.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime, Text, JSON,
    ForeignKey, UniqueConstraint, Index
)
from sqlalchemy.orm import DeclarativeBase, relationship


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Learner(Base):
    """A guest learner with preferences and progress."""
    __tablename__ = "learners"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    display_name = Column(String(50), nullable=True)
    language = Column(String(5), nullable=False, default="en")
    active_path = Column(String(20), nullable=False, default="professional")
    daily_goal_minutes = Column(Integer, nullable=False, default=10)
    timezone = Column(String(50), nullable=False, default="Asia/Kolkata")
    created_at = Column(DateTime, nullable=False, default=utcnow)
    updated_at = Column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    # Relationships
    sessions = relationship("Session", back_populates="learner", cascade="all, delete-orphan")
    attempts = relationship("Attempt", back_populates="learner", cascade="all, delete-orphan")
    progress = relationship("Progress", back_populates="learner", cascade="all, delete-orphan")
    saved_items = relationship("SavedItem", back_populates="learner", cascade="all, delete-orphan")
    review_schedules = relationship("ReviewSchedule", back_populates="learner", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="learner", cascade="all, delete-orphan")


class Session(Base):
    """Server-managed guest session linked to a learner."""
    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    learner_id = Column(String(36), ForeignKey("learners.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=utcnow)
    expires_at = Column(DateTime, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)

    learner = relationship("Learner", back_populates="sessions")

    __table_args__ = (
        Index("ix_sessions_learner_id", "learner_id"),
    )


class Lesson(Base):
    """A versioned lesson stored in the database (seeded from JSON content files)."""
    __tablename__ = "lessons"

    id = Column(String(50), primary_key=True)
    version = Column(String(10), nullable=False, default="1.0.0")
    type = Column(String(20), nullable=False)  # foundation | mission
    audience = Column(String(20), nullable=False)  # shared | professional | creator | college | school
    order_index = Column(Integer, nullable=False, default=0)
    prerequisites = Column(JSON, nullable=False, default=list)
    estimated_duration_minutes = Column(Integer, nullable=False, default=5)
    content = Column(JSON, nullable=False)  # Full multi-language content
    translation_status = Column(JSON, nullable=False, default=dict)
    review_date = Column(String(10), nullable=True)
    is_published = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=utcnow)
    updated_at = Column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    __table_args__ = (
        Index("ix_lessons_type_audience", "type", "audience"),
    )


class Attempt(Base):
    """A learner's attempt at a lesson task or understanding check."""
    __tablename__ = "attempts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    learner_id = Column(String(36), ForeignKey("learners.id", ondelete="CASCADE"), nullable=False)
    lesson_id = Column(String(50), ForeignKey("lessons.id"), nullable=False)
    lesson_version = Column(String(10), nullable=False)
    idempotency_key = Column(String(64), nullable=False)
    attempt_type = Column(String(20), nullable=False)  # task | check
    user_input = Column(JSON, nullable=False)
    feedback = Column(JSON, nullable=True)
    evaluation_mode = Column(String(30), nullable=False, default="demo_rule_based")
    criteria_results = Column(JSON, nullable=True)  # Which criteria were checked and results
    xp_awarded = Column(Integer, nullable=False, default=0)
    passed = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=utcnow)

    learner = relationship("Learner", back_populates="attempts")

    __table_args__ = (
        UniqueConstraint("learner_id", "idempotency_key", name="uq_attempt_idempotency"),
        Index("ix_attempts_learner_lesson", "learner_id", "lesson_id"),
    )


class Progress(Base):
    """Aggregated progress per learner per lesson."""
    __tablename__ = "progress"

    learner_id = Column(String(36), ForeignKey("learners.id", ondelete="CASCADE"), primary_key=True)
    lesson_id = Column(String(50), ForeignKey("lessons.id"), primary_key=True)
    completed = Column(Boolean, nullable=False, default=False)
    total_xp = Column(Integer, nullable=False, default=0)
    attempt_count = Column(Integer, nullable=False, default=0)
    checks_passed = Column(Integer, nullable=False, default=0)
    checks_total = Column(Integer, nullable=False, default=0)
    task_passed = Column(Boolean, nullable=False, default=False)
    first_completed_at = Column(DateTime, nullable=True)
    last_attempt_at = Column(DateTime, nullable=True)
    best_criteria_met = Column(Integer, nullable=False, default=0)

    learner = relationship("Learner", back_populates="progress")


class SavedItem(Base):
    """A bookmarked lesson, task, or example with labels and notes."""
    __tablename__ = "saved_items"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    learner_id = Column(String(36), ForeignKey("learners.id", ondelete="CASCADE"), nullable=False)
    lesson_id = Column(String(50), ForeignKey("lessons.id"), nullable=False)
    item_type = Column(String(20), nullable=False, default="lesson")  # lesson | task | example
    label = Column(String(20), nullable=False, default="useful")  # useful | difficult | review_later
    note = Column(Text, nullable=True)
    highlight_text = Column(Text, nullable=True)
    content_version = Column(String(10), nullable=True)
    language_at_save = Column(String(5), nullable=True)
    created_at = Column(DateTime, nullable=False, default=utcnow)
    updated_at = Column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    learner = relationship("Learner", back_populates="saved_items")

    __table_args__ = (
        Index("ix_saved_items_learner", "learner_id"),
        Index("ix_saved_items_label", "learner_id", "label"),
    )


class ReviewSchedule(Base):
    """Spaced repetition schedule per learner per lesson."""
    __tablename__ = "review_schedules"

    learner_id = Column(String(36), ForeignKey("learners.id", ondelete="CASCADE"), primary_key=True)
    lesson_id = Column(String(50), ForeignKey("lessons.id"), primary_key=True)
    next_review = Column(DateTime, nullable=False)
    interval_days = Column(Integer, nullable=False, default=1)
    success_count = Column(Integer, nullable=False, default=0)
    last_reviewed_at = Column(DateTime, nullable=True)
    difficulty_rating = Column(Integer, nullable=True)  # 1-5, learner self-report

    learner = relationship("Learner", back_populates="review_schedules")


class Project(Base):
    """A learner's saved artifact from a mission lesson."""
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    learner_id = Column(String(36), ForeignKey("learners.id", ondelete="CASCADE"), nullable=False)
    lesson_id = Column(String(50), ForeignKey("lessons.id"), nullable=False)
    title = Column(String(200), nullable=False)
    artifact_type = Column(String(30), nullable=False)  # email | action_list | script | post | revision_plan
    artifact_data = Column(JSON, nullable=False)
    lesson_version = Column(String(10), nullable=False)
    language = Column(String(5), nullable=False)
    created_at = Column(DateTime, nullable=False, default=utcnow)
    updated_at = Column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    learner = relationship("Learner", back_populates="projects")

    __table_args__ = (
        Index("ix_projects_learner", "learner_id"),
    )
