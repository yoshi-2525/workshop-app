from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.reservation import Reservation, ReservationStatus
from app.models.user import User
from app.schemas.reservation import ReservationRead
from app.services.reservations import (
    RESERVATION_LOAD_OPTIONS,
    abandon_payment,
    get_my_reservation,
    sync_pending_payment,
    to_reservation_read,
    to_reservation_reads,
)

router = APIRouter(prefix="/reservations", tags=["reservations"])

# 参加者は自分で予約をキャンセルできない。キャンセルは主催者が
# POST /api/workshops/{workshop_id}/reservations/{reservation_id}/cancel で行う


@router.get("/me", response_model=list[ReservationRead])
def list_my_reservations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ReservationRead]:
    # 支払われずに期限が過ぎた予約は、予約しなかったのと同じなので出さない
    reservations = db.scalars(
        select(Reservation)
        .options(*RESERVATION_LOAD_OPTIONS)
        .where(Reservation.user_id == current_user.id, Reservation.status != ReservationStatus.expired)
        .order_by(Reservation.created_at.desc(), Reservation.id.desc())
    ).all()
    return to_reservation_reads(db, reservations, current_user)


@router.get("/{reservation_id}", response_model=ReservationRead)
def get_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReservationRead:
    """自分の予約。オンライン決済の支払い待ちなら、Stripe から支払いの状態を読み直してから返す(決済完了画面の確認用)"""
    reservation = get_my_reservation(db, reservation_id, current_user)
    sync_pending_payment(db, reservation)
    db.commit()
    db.refresh(reservation)
    return to_reservation_read(db, reservation, current_user)


@router.post("/{reservation_id}/abandon-payment", response_model=ReservationRead)
def abandon_reservation_payment(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReservationRead:
    """オンライン決済の支払いをやめる。確保していた席はすぐ空き、あらためて予約し直せる"""
    reservation = get_my_reservation(db, reservation_id, current_user)
    abandon_payment(db, reservation)
    db.commit()
    db.refresh(reservation)
    return to_reservation_read(db, reservation, current_user)
