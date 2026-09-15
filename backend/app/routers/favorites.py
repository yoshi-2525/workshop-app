from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.favorite import Favorite
from app.models.user import User
from app.schemas.workshop import WorkshopRead
from app.services.workshops import to_workshop_read

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("", response_model=list[WorkshopRead])
def list_my_favorites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[WorkshopRead]:
    favorites = (
        db.query(Favorite)
        .filter(Favorite.user_id == current_user.id)
        .order_by(Favorite.created_at.desc())
        .all()
    )
    return [to_workshop_read(db, f.workshop, current_user) for f in favorites]
