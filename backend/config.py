"""
SkillOrbit Backend — Configuration
Loads settings from environment variables / .env file.
"""
import os
from pathlib import Path

# Base directory is the backend folder
BASE_DIR = Path(__file__).resolve().parent

# Project root (one level up from backend/)
PROJECT_ROOT = BASE_DIR.parent

# Data directory for SQLite database
DATA_DIR = PROJECT_ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

# Content directory
CONTENT_DIR = PROJECT_ROOT / "content"

# Database
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite+aiosqlite:///{DATA_DIR / 'skillorbit.db'}"
)

# Synchronous URL for Alembic migrations
DATABASE_URL_SYNC = DATABASE_URL.replace("+aiosqlite", "")

# Session
SESSION_SECRET = os.getenv("SESSION_SECRET", "dev-secret-change-in-production")
SESSION_COOKIE_NAME = "skillorbit_session"
SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60  # 30 days

# Server
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8000"))

# CORS
CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:5173")

# AI Provider
AI_PROVIDER = os.getenv("AI_PROVIDER", "demo")

# Supported languages
SUPPORTED_LANGUAGES = ["en", "hi", "te", "ta", "kn"]
LANGUAGE_NAMES = {
    "en": "English",
    "hi": "हिन्दी",
    "te": "తెలుగు",
    "ta": "தமிழ்",
    "kn": "ಕನ್ನಡ"
}

# Supported audience paths
SUPPORTED_PATHS = ["professional", "creator", "college", "school"]
PATH_NAMES = {
    "professional": "Working Professionals",
    "creator": "Content Creators",
    "college": "College Beginners",
    "school": "School Students"
}

# XP rewards
XP_LESSON_COMPLETE = 50
XP_CHECK_CORRECT = 10
XP_TASK_PASS = 30
XP_FIRST_ATTEMPT_BONUS = 20

# Review intervals (in days)
REVIEW_INTERVALS = [1, 3, 7, 14, 30]

# Input validation limits
MAX_DISPLAY_NAME_LENGTH = 50
MAX_NOTE_LENGTH = 2000
MAX_TASK_INPUT_LENGTH = 5000
