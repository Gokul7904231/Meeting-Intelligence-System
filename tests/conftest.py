from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.main import app
from app.api.dependencies import get_db_session
from app.db.database import Base
from app.db.models import User, Meeting, ActionItem


from sqlalchemy.pool import StaticPool

# Use an in-memory SQLite database for test suite isolation
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)



@pytest.fixture(scope="function", autouse=True)
def setup_db():
    # Create all database tables
    import sys
    print("Base metadata tables:", list(Base.metadata.tables.keys()), file=sys.stderr)
    Base.metadata.create_all(bind=engine)
    yield
    # Drop all database tables
    Base.metadata.drop_all(bind=engine)



@pytest.fixture(scope="function")
def db_session() -> Session:
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client(db_session) -> TestClient:
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    # Override dependencies
    app.dependency_overrides[get_db_session] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
