from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_user
from app.database import get_db
from app.models.reservation import Reservation
from app.models.user import User
from app.models.workshop import Workshop
from app.schemas.reservation import ReservationRead
from app.services.reservations import to_reservation_reads

router = APIRouter(prefix="/reservations", tags=["reservations"])

# 参加者は自分で予約をキャンセルできない。キャンセルは主催者が
# POST /api/workshops/{workshop_id}/reservations/{reservation_id}/cancel で行う


@router.get("/me", response_model=list[ReservationRead])
def list_my_reservations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ReservationRead]:
    reservations = (
        db.query(Reservation)
        .options(
            selectinload(Reservation.user),
            selectinload(Reservation.workshop).selectinload(Workshop.facilitator),
        )
        .filter(Reservation.user_id == current_user.id)
        .order_by(Reservation.created_at.desc())
        .all()
    )
    return to_reservation_reads(db, reservations, current_user)
