from collections.abc import Sequence

from sqlalchemy.orm import Session

from app.models.reservation import Reservation
from app.models.user import User
from app.schemas.reservation import ReservationRead
from app.services.workshops import to_workshop_reads


def to_reservation_reads(
    db: Session, reservations: Sequence[Reservation], current_user: User | None = None
) -> list[ReservationRead]:
    """複数件をまとめて変換する。ワークショップ部分は同じものを1回だけ組み立てる。

    予約者名・ワークショップ・主催者名は関連を参照するので、呼び出し側で
    selectinload(Reservation.user) と selectinload(Reservation.workshop).selectinload(Workshop.facilitator)
    をしておくと 1件ずつの読み込みを避けられる。
    """
    unique_workshops = list({r.workshop_id: r.workshop for r in reservations}.values())
    workshop_reads = {w.id: w for w in to_workshop_reads(db, unique_workshops, current_user)}
    return [
        ReservationRead(
            id=r.id,
            workshop_id=r.workshop_id,
            workshop=workshop_reads[r.workshop_id],
            user_id=r.user_id,
            user_name=r.user.name,
            attendee_name=r.attendee_name,
            contact=r.contact,
            ticket_count=r.ticket_count,
            status=r.status,
            attendance=r.attendance,
            created_at=r.created_at,
        )
        for r in reservations
    ]


def to_reservation_read(db: Session, reservation: Reservation, current_user: User | None = None) -> ReservationRead:
    return to_reservation_reads(db, [reservation], current_user)[0]
