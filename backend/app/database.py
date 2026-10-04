from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# セッションのタイムゾーンを UTC に固定し、CURRENT_TIMESTAMP の既定値を
# アプリが書き込む「タイムゾーンなしの UTC」の日時とそろえる。
# MySQL は wait_timeout を超えて使われなかった接続を切るので、使う前に生きているか確かめ、
# 一定時間ごとに張り直す
engine = create_engine(
    settings.database_url,
    connect_args={"init_command": "SET time_zone = '+00:00'"},
    pool_pre_ping=True,
    pool_recycle=3600,
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
