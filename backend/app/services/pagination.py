from typing import TypeVar

from fastapi import Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

T = TypeVar("T")


class PageQuery(BaseModel):
    """一覧 API 共通のページ指定。limit を指定したときだけページ分けし、総件数を X-Total-Count で返す"""

    model_config = ConfigDict(extra="forbid")

    limit: int | None = Field(default=None, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


def paginate(db: Session, stmt: Select[tuple[T]], page: PageQuery, response: Response) -> Select[tuple[T]]:
    if page.limit is None:
        return stmt
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery()))
    response.headers["X-Total-Count"] = str(total)
    return stmt.limit(page.limit).offset(page.offset)
