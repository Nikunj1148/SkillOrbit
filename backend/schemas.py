"""
SkillOrbit Backend — API Schemas
Pydantic models for request/response validation.
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from config import (
    SUPPORTED_LANGUAGES, SUPPORTED_PATHS,
    MAX_DISPLAY_NAME_LENGTH, MAX_NOTE_LENGTH, MAX_TASK_INPUT_LENGTH
)


# ── Session & Profile ──

class OnboardingRequest(BaseModel):
    language: str = Field(default="en", description="Preferred language code")
    path: str = Field(default="professional", description="Learning path")
    display_name: Optional[str] = Field(default=None, max_length=MAX_DISPLAY_NAME_LENGTH)
    daily_goal_minutes: int = Field(default=10, ge=5, le=60)
    timezone: str = Field(default="Asia/Kolkata")

    @field_validator("language")
    @classmethod
    def validate_language(cls, v):
        if v not in SUPPORTED_LANGUAGES:
            raise ValueError(f"Language must be one of: {SUPPORTED_LANGUAGES}")
        return v

    @field_validator("path")
    @classmethod
    def validate_path(cls, v):
        if v not in SUPPORTED_PATHS:
            raise ValueError(f"Path must be one of: {SUPPORTED_PATHS}")
        return v


class UpdateProfileRequest(BaseModel):
    language: Optional[str] = None
    path: Optional[str] = None
    display_name: Optional[str] = Field(default=None, max_length=MAX_DISPLAY_NAME_LENGTH)
    daily_goal_minutes: Optional[int] = Field(default=None, ge=5, le=60)
    timezone: Optional[str] = None

    @field_validator("language")
    @classmethod
    def validate_language(cls, v):
        if v is not None and v not in SUPPORTED_LANGUAGES:
            raise ValueError(f"Language must be one of: {SUPPORTED_LANGUAGES}")
        return v

    @field_validator("path")
    @classmethod
    def validate_path(cls, v):
        if v is not None and v not in SUPPORTED_PATHS:
            raise ValueError(f"Path must be one of: {SUPPORTED_PATHS}")
        return v


# ── Attempts ──

class TaskAttemptRequest(BaseModel):
    lesson_id: str = Field(..., min_length=1, max_length=50)
    user_input: str = Field(..., min_length=0, max_length=MAX_TASK_INPUT_LENGTH)
    idempotency_key: str = Field(..., min_length=1, max_length=64)


class CheckAttemptRequest(BaseModel):
    lesson_id: str = Field(..., min_length=1, max_length=50)
    check_index: int = Field(..., ge=0, le=10)
    selected_index: int = Field(..., ge=0, le=10)
    idempotency_key: str = Field(..., min_length=1, max_length=64)


# ── Saved Items ──

class SaveItemRequest(BaseModel):
    lesson_id: str = Field(..., min_length=1, max_length=50)
    item_type: str = Field(default="lesson")
    label: str = Field(default="useful")
    note: Optional[str] = Field(default=None, max_length=MAX_NOTE_LENGTH)
    highlight_text: Optional[str] = Field(default=None, max_length=MAX_TASK_INPUT_LENGTH)

    @field_validator("label")
    @classmethod
    def validate_label(cls, v):
        if v not in ("useful", "difficult", "review_later"):
            raise ValueError("Label must be: useful, difficult, or review_later")
        return v

    @field_validator("item_type")
    @classmethod
    def validate_item_type(cls, v):
        if v not in ("lesson", "task", "example"):
            raise ValueError("Item type must be: lesson, task, or example")
        return v


class UpdateSavedItemRequest(BaseModel):
    label: Optional[str] = None
    note: Optional[str] = Field(default=None, max_length=MAX_NOTE_LENGTH)

    @field_validator("label")
    @classmethod
    def validate_label(cls, v):
        if v is not None and v not in ("useful", "difficult", "review_later"):
            raise ValueError("Label must be: useful, difficult, or review_later")
        return v


# ── Projects ──

class SaveProjectRequest(BaseModel):
    lesson_id: str = Field(..., min_length=1, max_length=50)
    title: str = Field(..., min_length=1, max_length=200)
    artifact_type: str = Field(..., min_length=1, max_length=30)
    artifact_data: dict = Field(...)


# ── Review ──

class ReviewAttemptRequest(BaseModel):
    lesson_id: str = Field(..., min_length=1, max_length=50)
    difficulty_rating: Optional[int] = Field(default=None, ge=1, le=5)
