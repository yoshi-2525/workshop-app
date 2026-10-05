from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.user import UserRole

if TYPE_CHECKING:
    from app.models.user import User

# フォローの対象にできる役割。運営(admin)は一般の利用者が使う相手ではないので対象にしない。
# フォローの可否・一覧・新着の通知はすべてこの値で判定する
FOLLOWABLE_ROLE = UserRole.facilitator


class FacilitatorFollow(Base):
    """ユーザーが主催者をフォローしていること。フォロー先は role が facilitator のユーザーだけ"""

    __tablename__ = "facilitator_follows"
    __table_args__ = (
        UniqueConstraint("follower_id", "facilitator_id", name="uq_follow_follower_facilitator"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    follower_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    facilitator_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )

    follower: Mapped["User"] = relationship(foreign_keys=[follower_id], back_populates="following")
    facilitator: Mapped["User"] = relationship(foreign_keys=[facilitator_id], back_populates="followers")
