from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user_optional
from app.core.errors import FACILITATOR_NOT_FOUND, not_found
from app.database import get_db
from app.models.follow import FOLLOWABLE_ROLE
from app.models.user import User, UserRole
from app.schemas.user import FacilitatorProfile, FacilitatorViewer
from app.services.follows import is_following

router = APIRouter(prefix="/facilitators", tags=["facilitators"])


@router.get("/{user_id}", response_model=FacilitatorProfile)
def get_facilitator_profile(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> FacilitatorProfile:
    user = db.get(User, user_id)
    if user is None or user.role not in (UserRole.facilitator, UserRole.admin):
        raise not_found(FACILITATOR_NOT_FOUND)
    profile = FacilitatorProfile.model_validate(user)
    # フォローできるのは主催者だけなので、未ログインのとき・運営のページ・自分自身のページでは null
    if current_user is not None and current_user.id != user.id and user.role == FOLLOWABLE_ROLE:
        profile.viewer = FacilitatorViewer(is_following=is_following(db, current_user, user.id))
    return profile
