from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_user
from app.core.timeutil import utcnow_naive
from app.database import get_db
from app.models.reservation import Reservation, ReservationStatus
from app.models.user import User
from app.models.workshop import Workshop
from app.schemas.reservation import ReservationRead
from app.services.reservations import to_reservation_reads

router = APIRouter(prefix="/reservations", tags=["reservations"])


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


@router.delete("/{reservation_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    reservation = db.get(Reservation, reservation_id)
    if reservation is None or reservation.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="予約が見つかりません")
    if reservation.workshop.start_at <= utcnow_naive():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="開始済みのワークショップの予約はキャンセルできません",
        )
    reservation.status = ReservationStatus.canceled
    db.commit()
