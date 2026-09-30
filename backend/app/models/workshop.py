import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, event, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.timeutil import utcnow_naive
from app.database import Base

if TYPE_CHECKING:
    from app.models.favorite import Favorite
    from app.models.notification import Notification
    from app.models.reservation import Reservation
    from app.models.user import User


class WorkshopStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    canceled = "canceled"


class LocationType(str, enum.Enum):
    online = "online"
    offline = "offline"


class Workshop(Base):
    __tablename__ = "workshops"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    image_url: Mapped[str] = mapped_column(String(2000), nullable=False, default="")
    location: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    location_type: Mapped[LocationType] = mapped_column(
        Enum(LocationType, name="location_type"), default=LocationType.offline, nullable=False
    )
    start_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    price: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cancellation_policy: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[WorkshopStatus] = mapped_column(
        Enum(WorkshopStatus, name="workshop_status"), default=WorkshopStatus.draft, nullable=False
    )
    facilitator_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    # 初めて公開(published)になった日時。一度公開したあとに下書きへ戻しても保持する
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )

    facilitator: Mapped["User"] = relationship(back_populates="workshops")
    reservations: Mapped[list["Reservation"]] = relationship(
        back_populates="workshop", cascade="all, delete-orphan"
    )
    favorites: Mapped[list["Favorite"]] = relationship(
        back_populates="workshop", cascade="all, delete-orphan"
    )
    notifications: Mapped[list["Notification"]] = relationship(
        back_populates="workshop", cascade="all, delete-orphan"
    )


@event.listens_for(Workshop, "before_insert")
@event.listens_for(Workshop, "before_update")
def _set_published_at(_mapper, _connection, workshop: Workshop) -> None:
    # API・シードなど、どの経路で公開しても公開日時が記録されるようにする
    if workshop.status == WorkshopStatus.published and workshop.published_at is None:
        workshop.published_at = utcnow_naive()
