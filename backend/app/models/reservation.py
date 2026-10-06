import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.payment import Payment
    from app.models.user import User
    from app.models.workshop import Workshop

# 1回の予約で申し込めるチケット枚数の上限。API の検証と DB の CHECK 制約の両方で使う
MAX_TICKETS_PER_RESERVATION = 4


class ReservationStatus(str, enum.Enum):
    confirmed = "confirmed"
    canceled = "canceled"
    # オンライン決済の支払い待ち。payment_expires_at までは席を確保しておく
    pending_payment = "pending_payment"
    # 支払われないまま期限が過ぎた。同じ参加者が予約し直すときはこの行を使い回す
    expired = "expired"


class CancelReason(str, enum.Enum):
    """主催者が予約を取り消した理由。オンライン決済の返金で、手数料を誰が負担するかが変わる"""

    # 参加者からの申し出による取消。決済手数料と運営手数料を差し引いて返金する
    participant = "participant"
    # 主催者の都合による取消(ワークショップの中止を含む)。全額を返金する
    facilitator = "facilitator"


class AttendanceStatus(str, enum.Enum):
    """開催当日に主催者が記録する出欠"""

    unconfirmed = "unconfirmed"
    present = "present"
    absent = "absent"


class Reservation(Base):
    __tablename__ = "reservations"
    __table_args__ = (
        UniqueConstraint("workshop_id", "user_id", name="uq_reservation_workshop_user"),
        CheckConstraint(
            f"ticket_count BETWEEN 1 AND {MAX_TICKETS_PER_RESERVATION}",
            name="ck_reservation_ticket_count",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    workshop_id: Mapped[int] = mapped_column(ForeignKey("workshops.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    contact: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    ticket_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[ReservationStatus] = mapped_column(
        Enum(ReservationStatus, name="reservation_status"),
        default=ReservationStatus.confirmed,
        nullable=False,
    )
    attendance: Mapped[AttendanceStatus] = mapped_column(
        Enum(AttendanceStatus, name="attendance_status"),
        default=AttendanceStatus.unconfirmed,
        server_default=AttendanceStatus.unconfirmed.value,
        nullable=False,
    )
    # 支払い待ち(pending_payment)の席を確保しておく期限
    payment_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # 主催者が取り消したときの理由。取り消されていなければ None
    cancel_reason: Mapped[CancelReason | None] = mapped_column(
        Enum(CancelReason, name="cancel_reason"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )

    workshop: Mapped["Workshop"] = relationship(back_populates="reservations")
    user: Mapped["User"] = relationship(back_populates="reservations")
    # 支払いは会計の記録なので、予約を ORM で消しても一緒には消さない(DB の外部キーで削除を止める)
    payments: Mapped[list["Payment"]] = relationship(
        back_populates="reservation", order_by="Payment.id", passive_deletes="all"
    )
