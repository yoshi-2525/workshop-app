import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.reservation import Reservation

# 参加費の通貨。日本円は最小単位が 1 円なので、金額はそのまま整数で扱う
PAYMENT_CURRENCY = "jpy"
# Stripe のオブジェクト ID(acct_... / cs_... / pi_... / evt_...)を保存する列の長さ
STRIPE_ID_MAX_LENGTH = 255


class PaymentStatus(str, enum.Enum):
    # Checkout を作成し、支払いを待っている
    pending = "pending"
    paid = "paid"
    # 支払われないまま Checkout の期限が過ぎた
    expired = "expired"
    # 取消・中止で返金が決まり、Stripe への依頼を待っている(失敗したら定期処理が再試行する)
    refund_pending = "refund_pending"
    refunded = "refunded"
    # 再試行しても返金できなかった。運営が対応する
    refund_failed = "refund_failed"


class Payment(Base):
    """予約1件に対する Stripe での支払い1回分。

    支払いをやめて予約し直すと試行が増えるので、1つの予約に複数ありうる。paid になるのは最大1件
    """

    __tablename__ = "payments"
    __table_args__ = (
        UniqueConstraint("stripe_checkout_session_id", name="uq_payments_stripe_checkout_session_id"),
        # Webhook(返金など)は PaymentIntent で照合する。1つの PaymentIntent は1回の支払いにだけ対応する
        UniqueConstraint("stripe_payment_intent_id", name="uq_payments_stripe_payment_intent_id"),
        CheckConstraint("amount > 0", name="ck_payments_amount"),
        CheckConstraint(
            "application_fee_amount >= 0 AND application_fee_amount <= amount", name="ck_payments_application_fee"
        ),
        CheckConstraint(
            "refund_amount IS NULL OR (refund_amount >= 0 AND refund_amount <= amount)", name="ck_payments_refund"
        ),
        CheckConstraint("refund_attempts >= 0", name="ck_payments_refund_attempts"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    reservation_id: Mapped[int] = mapped_column(ForeignKey("reservations.id"), nullable=False, index=True)
    # 決済した主催者の連結アカウント。主催者のアカウントが後で変わっても、この支払いの取得・返金はここで行う
    stripe_account_id: Mapped[str] = mapped_column(String(STRIPE_ID_MAX_LENGTH), nullable=False)
    stripe_checkout_session_id: Mapped[str | None] = mapped_column(String(STRIPE_ID_MAX_LENGTH), nullable=True)
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(STRIPE_ID_MAX_LENGTH), nullable=True)
    # 返金の ID(re_...)。運営の手動対応や、Stripe 側の返金との照合に使う
    stripe_refund_id: Mapped[str | None] = mapped_column(String(STRIPE_ID_MAX_LENGTH), nullable=True)
    # 参加者が支払う金額(参加費 × 枚数)。予約時の値を残す
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    # 運営の手数料
    application_fee_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    # Stripe の決済手数料。支払い完了時に Stripe から実際の額を取得する
    stripe_fee_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # 返金が決まったときに確定する返金額
    refund_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default=PAYMENT_CURRENCY)
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status"), default=PaymentStatus.pending, nullable=False
    )
    # 返金の依頼に失敗した回数。上限を超えたら refund_failed にする
    refund_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=text("0"))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )

    reservation: Mapped["Reservation"] = relationship(back_populates="payments")
