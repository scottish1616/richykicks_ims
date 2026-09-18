"""Compatibility entrypoint for Render and other hosts that start uvicorn from the repo root.

Render's default command often resolves to `uvicorn main:app` from the project root,
while this project exposes the FastAPI ASGI app in `backend/app/main.py`.
"""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"

if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.main import app  # noqa: E402
