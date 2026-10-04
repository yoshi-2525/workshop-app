from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.reservation import Reservation, ReservationStatus
from app.models.workshop import Workshop


def confirmed_participant_ids(db: Session, workshop: Workshop) -> list[int]:
    """予約が確定している参加者の ID。お知らせ・リマインダーの送り先に使う。

    主催者は自分のワークショップを予約できないが、念のため主催者本人は含めない(自分宛てのやり取り・通知を作らない)
    """
    stmt = select(Reservation.user_id).where(
        Reservation.workshop_id == workshop.id,
        Reservation.status == ReservationStatus.confirmed,
        Reservation.user_id != workshop.facilitator_id,
    )
    return list(db.scalars(stmt))
