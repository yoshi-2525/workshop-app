from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import FacilitatorProfile

router = APIRouter(prefix="/facilitators", tags=["facilitators"])


@router.get("/{user_id}", response_model=FacilitatorProfile)
def get_facilitator_profile(user_id: int, db: Session = Depends(get_db)) -> User:
    user = db.get(User, user_id)
    if user is None or user.role not in (UserRole.facilitator, UserRole.admin):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="主催者が見つかりません")
    return user
