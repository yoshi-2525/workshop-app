from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# Pin the session time zone so CURRENT_TIMESTAMP defaults are UTC, matching
# the naive-UTC datetimes the app writes itself.
engine = create_engine(
    settings.database_url,
    connect_args={"init_command": "SET time_zone = '+00:00'"},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
