from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.workshop import Workshop
from app.schemas.pagination import PageQuery
from app.schemas.user import FacilitatorProfile, FacilitatorViewer
from app.schemas.workshop import FollowedWorkshopsQuery, WorkshopRead
from app.services.follows import (
    followed_facilitators_select,
    followed_workshops_select,
    follow_facilitator,
    unfollow_facilitator,
)
from app.services.pagination import paginate
from app.services.workshops import to_workshop_reads

# 主催者のフォロー。フォロー・解除は主催者単位の URL(/facilitators/{id}/follow)に置く
router = APIRouter(tags=["follows"])


@router.post("/facilitators/{facilitator_id}/follow", status_code=status.HTTP_201_CREATED)
def follow(
    facilitator_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FacilitatorViewer:
    follow_facilitator(db, current_user, facilitator_id)
    return FacilitatorViewer(is_following=True)


@router.delete("/facilitators/{facilitator_id}/follow", status_code=status.HTTP_204_NO_CONTENT)
def unfollow(
    facilitator_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    unfollow_facilitator(db, current_user, facilitator_id)


@router.get("/follows/facilitators", response_model=list[FacilitatorProfile])
def list_followed_facilitators(
    page: Annotated[PageQuery, Query()],
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[FacilitatorProfile]:
    users = db.scalars(paginate(db, followed_facilitators_select(current_user), page, response)).all()
    following = FacilitatorViewer(is_following=True)
    return [FacilitatorProfile.model_validate(u).model_copy(update={"viewer": following}) for u in users]


@router.get("/follows/workshops", response_model=list[WorkshopRead])
def list_followed_workshops(
    query: Annotated[FollowedWorkshopsQuery, Query()],
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[WorkshopRead]:
    stmt = paginate(db, followed_workshops_select(current_user, query.sort), query, response)
    workshops = db.scalars(stmt.options(selectinload(Workshop.facilitator))).all()
    return to_workshop_reads(db, workshops, current_user)
