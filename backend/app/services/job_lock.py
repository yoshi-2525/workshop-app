from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import text
from sqlalchemy.orm import Session


@contextmanager
def named_lock(db: Session, name: str) -> Iterator[bool]:
    """複数のプロセスで同時に動かしてはいけない定期処理のための、MySQL の名前付きロック。

    取れたら True を渡し、抜けるときに手放す。他のプロセスが実行中なら待たずに False を渡す。
    GET_LOCK は接続ごとに持つロックで、セッションの接続は commit のたびにプールへ返るので、
    ロック専用の接続を別に確保して、処理が終わるまで持ち続ける
    """
    with db.get_bind().connect() as lock_conn:
        got_lock = lock_conn.scalar(text("SELECT GET_LOCK(:name, 0)"), {"name": name})
        if got_lock != 1:
            yield False
            return
        try:
            yield True
        finally:
            lock_conn.scalar(text("SELECT RELEASE_LOCK(:name)"), {"name": name})
