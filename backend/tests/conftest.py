"""
Shared pytest fixtures. Point TEST_DATABASE_URL at a throwaway
Postgres database - never run tests against production data.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client():
    return TestClient(app)
