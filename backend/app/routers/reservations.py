from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.reservation import Reservation, ReservationStatus
from app.models.user import User
from app.schemas.reservation import ReservationRead
from app.services.workshops import to_workshop_read

router = APIRouter(prefix="/reservations", tags=["reservations"])


@router.get("/me", response_model=list[ReservationRead])
def list_my_reservations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ReservationRead]:
    reservations = (
        db.query(Reservation)
        .filter(Reservation.user_id == current_user.id)
        .order_by(Reservation.created_at.desc())
        .all()
    )
    return [
        ReservationRead(
            id=r.id,
            workshop_id=r.workshop_id,
            workshop=to_workshop_read(db, r.workshop, current_user),
            user_id=r.user_id,
            user_name=current_user.name,
            attendee_name=r.attendee_name,
            contact=r.contact,
            ticket_count=r.ticket_count,
            status=r.status,
            created_at=r.created_at,
        )
        for r in reservations
    ]


@router.delete("/{reservation_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    reservation = db.get(Reservation, reservation_id)
    if reservation is None or reservation.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="予約が見つかりません")
    reservation.status = ReservationStatus.canceled
    db.commit()
