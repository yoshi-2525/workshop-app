from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# セッションのタイムゾーンを UTC に固定し、CURRENT_TIMESTAMP の既定値を
# アプリが書き込む「タイムゾーンなしの UTC」の日時とそろえる。
# MySQL は wait_timeout を超えて使われなかった接続を切るので、使う前に生きているか確かめ、
# 一定時間ごとに張り直す。
# 隔離レベルは READ COMMITTED に固定する。MySQL の既定(REPEATABLE READ)では、行をロックしたあとの集計も
# トランザクションの最初の時点のスナップショットを読むため、「lock_workshop してから予約数を数える」で
# 他のリクエストが確定した予約が見えず、定員を超えて受け付けてしまう
engine = create_engine(
    settings.database_url,
    isolation_level="READ COMMITTED",
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
