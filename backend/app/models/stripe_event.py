from datetime import datetime

from sqlalchemy import DateTime, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.payment import STRIPE_ID_MAX_LENGTH


class StripeEvent(Base):
    """処理した Stripe の Webhook イベント。

    Stripe は同じイベントを再送することがあるので、ID を主キーにして二重に処理しないようにする
    """

    __tablename__ = "stripe_events"

    event_id: Mapped[str] = mapped_column(String(STRIPE_ID_MAX_LENGTH), primary_key=True)
    type: Mapped[str] = mapped_column(String(255), nullable=False)
    received_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )
