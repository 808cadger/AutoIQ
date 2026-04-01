"""models/database.py — Auto IQ SQLAlchemy engine + session factory"""
# Aloha from Pearl City!

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# #ASSUMPTION: DB_PATH env var defaults to local SQLite file
DB_PATH = os.getenv("DB_PATH", "./autoiq.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # SQLite quirk for multi-thread
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency — yields a DB session and ensures cleanup."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables. Called once at startup."""
    from models import estimate  # noqa: F401 — ensure model is registered
    Base.metadata.create_all(bind=engine)
