from typing import TypeVar

from fastapi import Response
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.schemas.pagination import PageQuery

T = TypeVar("T")


def paginate(db: Session, stmt: Select[tuple[T]], page: PageQuery, response: Response) -> Select[tuple[T]]:
    """page.limit があれば、絞り込み後の総件数を X-Total-Count ヘッダーに入れ、その1ページ分に絞る"""
    if page.limit is None:
        return stmt
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery()))
    response.headers["X-Total-Count"] = str(total)
    return stmt.limit(page.limit).offset(page.offset)
