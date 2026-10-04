from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import require_roles
from app.database import get_db
from app.models.user import User, UserRole
from app.models.workshop import Workshop
from app.schemas.workshop import WorkshopRead
from app.schemas.pagination import PageQuery
from app.services.pagination import paginate
from app.services.workshops import to_workshop_reads

# 主催者・管理者が自分のワークショップを管理するための API
router = APIRouter(prefix="/manage", tags=["manage"])


@router.get("/workshops", response_model=list[WorkshopRead])
def list_managed_workshops(
    page: Annotated[PageQuery, Query()],
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.facilitator)),
) -> list[WorkshopRead]:
    """下書き・中止を含む、自分のワークショップ(admin は全員分)を開催日時の新しい順で返す"""
    stmt = (
        select(Workshop)
        .options(selectinload(Workshop.facilitator))
        .order_by(Workshop.start_at.desc(), Workshop.id.desc())
    )
    if current_user.role != UserRole.admin:
        stmt = stmt.where(Workshop.facilitator_id == current_user.id)
    return to_workshop_reads(db, db.scalars(paginate(db, stmt, page, response)).all(), current_user)
