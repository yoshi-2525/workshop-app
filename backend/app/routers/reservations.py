from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.reservation import Reservation
from app.models.user import User
from app.schemas.reservation import ReservationRead
from app.services.reservations import RESERVATION_LOAD_OPTIONS, to_reservation_reads

router = APIRouter(prefix="/reservations", tags=["reservations"])

# 参加者は自分で予約をキャンセルできない。キャンセルは主催者が
# POST /api/workshops/{workshop_id}/reservations/{reservation_id}/cancel で行う


@router.get("/me", response_model=list[ReservationRead])
def list_my_reservations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ReservationRead]:
    reservations = db.scalars(
        select(Reservation)
        .options(*RESERVATION_LOAD_OPTIONS)
        .where(Reservation.user_id == current_user.id)
        .order_by(Reservation.created_at.desc(), Reservation.id.desc())
    ).all()
    return to_reservation_reads(db, reservations, current_user)
