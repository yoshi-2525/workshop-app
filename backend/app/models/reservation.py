import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.workshop import Workshop


class ReservationStatus(str, enum.Enum):
    confirmed = "confirmed"
    canceled = "canceled"


class Reservation(Base):
    __tablename__ = "reservations"
    __table_args__ = (
        UniqueConstraint("workshop_id", "user_id", name="uq_reservation_workshop_user"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    workshop_id: Mapped[int] = mapped_column(ForeignKey("workshops.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    attendee_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    contact: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    ticket_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[ReservationStatus] = mapped_column(
        Enum(ReservationStatus, name="reservation_status"),
        default=ReservationStatus.confirmed,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=text("CURRENT_TIMESTAMP"))

    workshop: Mapped["Workshop"] = relationship(back_populates="reservations")
    user: Mapped["User"] = relationship(back_populates="reservations")
