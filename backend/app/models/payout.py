import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User

# 振込先口座の各項目の長さ。スキーマの入力の検証と揃える
BANK_CODE_LENGTH = 4
BRANCH_CODE_LENGTH = 3
ACCOUNT_NUMBER_LENGTH = 7
BANK_NAME_MAX_LENGTH = 100
ACCOUNT_HOLDER_MAX_LENGTH = 100
PAYOUT_NOTE_MAX_LENGTH = 1000


class BankAccountType(str, enum.Enum):
    # 普通預金
    ordinary = "ordinary"
    # 当座預金
    checking = "checking"


class PayoutRequestStatus(str, enum.Enum):
    # 主催者が申請し、運営の振込を待っている
    requested = "requested"
    # 運営が振り込んだ
    paid = "paid"
    # 運営が振り込まずに取り下げた(口座の誤りなど)。申請額は残高に戻る
    rejected = "rejected"


class _BankAccountColumns:
    """振込先口座の項目。登録中の口座と、申請時に写した口座の両方で使う"""

    bank_name: Mapped[str] = mapped_column(String(BANK_NAME_MAX_LENGTH), nullable=False)
    bank_code: Mapped[str] = mapped_column(String(BANK_CODE_LENGTH), nullable=False)
    branch_name: Mapped[str] = mapped_column(String(BANK_NAME_MAX_LENGTH), nullable=False)
    branch_code: Mapped[str] = mapped_column(String(BRANCH_CODE_LENGTH), nullable=False)
    account_type: Mapped[BankAccountType] = mapped_column(
        Enum(BankAccountType, name="bank_account_type"), nullable=False
    )
    account_number: Mapped[str] = mapped_column(String(ACCOUNT_NUMBER_LENGTH), nullable=False)
    # 口座名義(カナ)
    account_holder: Mapped[str] = mapped_column(String(ACCOUNT_HOLDER_MAX_LENGTH), nullable=False)


class PayoutBankAccount(_BankAccountColumns, Base):
    """主催者の振込先口座。1人1口座で、登録し直すと上書きする"""

    __tablename__ = "payout_bank_accounts"
    __table_args__ = (UniqueConstraint("user_id", name="uq_payout_bank_accounts_user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )

    user: Mapped["User"] = relationship(back_populates="payout_bank_account")


class PayoutRequest(_BankAccountColumns, Base):
    """主催者からの振込の申請1件。運営が銀行から手動で振り込み、結果を記録する。

    振込先は申請時の口座を写して持つ。申請の後に口座を登録し直しても、振り込む先が変わらないようにするため
    """

    __tablename__ = "payout_requests"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_payout_requests_amount"),
        CheckConstraint(
            "transfer_fee >= 0 AND transfer_amount > 0 AND transfer_amount + transfer_fee = amount",
            name="ck_payout_requests_transfer",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    facilitator_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    # 残高から差し引く申請額
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    # 振込手数料(主催者の負担)。申請時の設定の値を残す
    transfer_fee: Mapped[int] = mapped_column(Integer, nullable=False)
    # 実際に振り込む額(申請額 − 振込手数料)
    transfer_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[PayoutRequestStatus] = mapped_column(
        Enum(PayoutRequestStatus, name="payout_request_status"),
        default=PayoutRequestStatus.requested,
        nullable=False,
    )
    # 運営のメモ(振込日・取り下げの理由など)。主催者にも見せる
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    requested_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )
    # 振込済み・取り下げにした日時
    processed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    facilitator: Mapped["User"] = relationship()
