"""
SkillOrbit Backend — Content Seeder
Loads structured JSON content files into the database.
Repeatable: updates existing lessons without resetting learner data.
"""
import json
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models import Lesson
from config import CONTENT_DIR


async def seed_content(db: AsyncSession) -> dict:
    """
    Seed lessons from JSON files in the content directory.
    Returns a summary of what was seeded/updated.
    """
    stats = {"created": 0, "updated": 0, "errors": []}

    content_dirs = [
        CONTENT_DIR / "foundations",
        CONTENT_DIR / "missions",
    ]

    for content_dir in content_dirs:
        if not content_dir.exists():
            stats["errors"].append(f"Directory not found: {content_dir}")
            continue

        for json_file in sorted(content_dir.glob("*.json")):
            try:
                with open(json_file, "r", encoding="utf-8") as f:
                    data = json.load(f)

                lesson_id = data["id"]
                result = await db.execute(
                    select(Lesson).where(Lesson.id == lesson_id)
                )
                existing = result.scalar_one_or_none()

                if existing:
                    # Update content without resetting learner progress
                    existing.version = data.get("version", existing.version)
                    existing.content = data.get("content", existing.content)
                    existing.prerequisites = data.get("prerequisites", existing.prerequisites)
                    existing.estimated_duration_minutes = data.get("estimated_duration_minutes", existing.estimated_duration_minutes)
                    existing.translation_status = data.get("translation_status", existing.translation_status)
                    existing.review_date = data.get("review_date", existing.review_date)
                    stats["updated"] += 1
                else:
                    lesson = Lesson(
                        id=lesson_id,
                        version=data.get("version", "1.0.0"),
                        type=data.get("type", "foundation"),
                        audience=data.get("audience", "shared"),
                        order_index=data.get("order", 0),
                        prerequisites=data.get("prerequisites", []),
                        estimated_duration_minutes=data.get("estimated_duration_minutes", 5),
                        content=data.get("content", {}),
                        translation_status=data.get("translation_status", {}),
                        review_date=data.get("review_date"),
                    )
                    db.add(lesson)
                    stats["created"] += 1

            except Exception as e:
                stats["errors"].append(f"{json_file.name}: {str(e)}")

    await db.flush()
    return stats
