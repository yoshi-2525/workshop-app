from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_user
from app.core.errors import conflict
from app.database import get_db
from app.models.favorite import Favorite
from app.models.user import User
from app.models.workshop import Workshop
from app.schemas.workshop import WorkshopRead
from app.services.workshops import get_viewable_workshop, to_workshop_read, to_workshop_reads

# お気に入りの一覧・追加・削除。追加と削除はワークショップ単位の URL(/workshops/{id}/favorite)に置く
router = APIRouter(tags=["favorites"])


def _my_favorite(workshop_id: int, user: User):
    return select(Favorite).where(Favorite.workshop_id == workshop_id, Favorite.user_id == user.id)


@router.get("/favorites", response_model=list[WorkshopRead])
def list_my_favorites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[WorkshopRead]:
    favorites = db.scalars(
        select(Favorite)
        .options(selectinload(Favorite.workshop).selectinload(Workshop.facilitator))
        .where(Favorite.user_id == current_user.id)
        .order_by(Favorite.created_at.desc())
    ).all()
    return to_workshop_reads(db, [f.workshop for f in favorites], current_user)


@router.post("/workshops/{workshop_id}/favorite", response_model=WorkshopRead, status_code=status.HTTP_201_CREATED)
def add_favorite(
    workshop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkshopRead:
    # 詳細ページを見られるワークショップは、お気に入りにも追加できる
    workshop = get_viewable_workshop(db, workshop_id, current_user)

    existing = db.scalar(_my_favorite(workshop_id, current_user))
    if existing is None:
        db.add(Favorite(workshop_id=workshop_id, user_id=current_user.id))
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise conflict("既にお気に入り登録済みです") from exc
    return to_workshop_read(db, workshop, current_user)


@router.delete("/workshops/{workshop_id}/favorite", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(
    workshop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    favorite = db.scalar(_my_favorite(workshop_id, current_user))
    if favorite is not None:
        db.delete(favorite)
        db.commit()
