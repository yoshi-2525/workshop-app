from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Text, UniqueConstraint, false, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.workshop import Workshop

# 1通のメッセージの文字数の上限。API の検証で使う
INQUIRY_MESSAGE_MAX_LENGTH = 2000


class Inquiry(Base):
    """参加者から主催者への問い合わせ。ワークショップと参加者の組み合わせごとに1つのやり取りにまとめる"""

    __tablename__ = "inquiries"
    __table_args__ = (UniqueConstraint("workshop_id", "participant_id", name="uq_inquiry_workshop_participant"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    workshop_id: Mapped[int] = mapped_column(ForeignKey("workshops.id"), nullable=False)
    # 問い合わせた側のユーザー。相手はワークショップの主催者
    participant_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    # 一覧を新しいやり取り順に並べるための、最後のメッセージの日時
    last_message_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    # それぞれが最後に読んだメッセージの ID。これより後に相手から届いたメッセージを未読とする
    # (DATETIME は秒単位なので、同じ秒に届いたメッセージも区別できるよう ID で比べる)
    participant_last_read_id: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    facilitator_last_read_id: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )

    workshop: Mapped["Workshop"] = relationship(back_populates="inquiries")
    participant: Mapped["User"] = relationship()
    messages: Mapped[list["InquiryMessage"]] = relationship(
        back_populates="inquiry",
        cascade="all, delete-orphan",
        order_by="InquiryMessage.id",
    )


class InquiryMessage(Base):
    __tablename__ = "inquiry_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    inquiry_id: Mapped[int] = mapped_column(ForeignKey("inquiries.id"), nullable=False, index=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    # 主催者が参加者全員に一斉送信したお知らせか(各参加者とのやり取りに1通ずつ追加される)
    is_broadcast: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=false())
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )

    inquiry: Mapped["Inquiry"] = relationship(back_populates="messages")
    sender: Mapped["User"] = relationship()
