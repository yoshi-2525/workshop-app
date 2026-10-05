import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.payment import STRIPE_ID_MAX_LENGTH

if TYPE_CHECKING:
    from app.models.favorite import Favorite
    from app.models.follow import FacilitatorFollow
    from app.models.notification import Notification
    from app.models.reservation import Reservation
    from app.models.workshop import Workshop


class UserRole(str, enum.Enum):
    admin = "admin"
    facilitator = "facilitator"
    participant = "participant"


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("stripe_account_id", name="uq_users_stripe_account_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), default=UserRole.participant, nullable=False
    )
    bio: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # 主催者アイコンの URL。未設定なら空文字
    avatar_url: Mapped[str] = mapped_column(String(2000), nullable=False, default="")
    # 参加費を受け取る Stripe の連結アカウント(Express)。受け取り設定を始めるまでは None
    stripe_account_id: Mapped[str | None] = mapped_column(String(STRIPE_ID_MAX_LENGTH), nullable=True)
    # Stripe の審査が済み、カード決済を受け付けられるか。Stripe のアカウント情報から同期する
    stripe_charges_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("0")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )

    workshops: Mapped[list["Workshop"]] = relationship(back_populates="facilitator")
    reservations: Mapped[list["Reservation"]] = relationship(back_populates="user")
    favorites: Mapped[list["Favorite"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    notifications: Mapped[list["Notification"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    # 自分がフォローしている主催者 / 自分(主催者)をフォローしているユーザー
    following: Mapped[list["FacilitatorFollow"]] = relationship(
        foreign_keys="FacilitatorFollow.follower_id", back_populates="follower", cascade="all, delete-orphan"
    )
    followers: Mapped[list["FacilitatorFollow"]] = relationship(
        foreign_keys="FacilitatorFollow.facilitator_id", back_populates="facilitator", cascade="all, delete-orphan"
    )
