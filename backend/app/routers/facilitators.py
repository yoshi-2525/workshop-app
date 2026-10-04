from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.errors import not_found
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import FacilitatorProfile

router = APIRouter(prefix="/facilitators", tags=["facilitators"])


@router.get("/{user_id}", response_model=FacilitatorProfile)
def get_facilitator_profile(user_id: int, db: Session = Depends(get_db)) -> User:
    user = db.get(User, user_id)
    if user is None or user.role not in (UserRole.facilitator, UserRole.admin):
        raise not_found("主催者が見つかりません")
    return user
