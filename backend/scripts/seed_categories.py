"""
Seed the fixed 8 product categories (PRD section 5). Safe to run more
than once - only inserts names that don't already exist, never
duplicates or removes categories.

Usage (run from the backend/ directory, with venv active):
    python scripts/seed_categories.py
"""
import sys

sys.path.insert(0, ".")

from app.core.database import SessionLocal
from app.models.category import Category, SEED_CATEGORY_NAMES


def main() -> None:
    db = SessionLocal()
    try:
        existing = {c.name for c in db.query(Category).all()}
        created = 0
        for name in SEED_CATEGORY_NAMES:
            if name not in existing:
                db.add(Category(name=name))
                created += 1
        db.commit()
        print(f"Seeded {created} new categories ({len(SEED_CATEGORY_NAMES)} total expected).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
