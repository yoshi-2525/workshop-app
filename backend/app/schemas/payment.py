import re
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints
from pydantic_core import PydanticCustomError

from app.models.payment import PaymentStatus
from app.models.payout import (
    ACCOUNT_HOLDER_MAX_LENGTH,
    ACCOUNT_NUMBER_LENGTH,
    BANK_CODE_LENGTH,
    BANK_NAME_MAX_LENGTH,
    BRANCH_CODE_LENGTH,
    PAYOUT_NOTE_MAX_LENGTH,
    BankAccountType,
    PayoutRequestStatus,
)
from app.schemas.pagination import PageQuery
from app.schemas.types import TrimmedStr, UTCDateTime


def _digits(length: int):
    return Annotated[str, StringConstraints(strip_whitespace=True, pattern=rf"^[0-9]{{{length}}}$")]


# 口座名義は銀行の振込で使える全角カタカナ・英大文字・数字・記号(スペース・括弧・ピリオド・ハイフンなど)に限る。
# 記号だけの名義にならないよう、カナか英字を1文字以上含める(_require_letter)。フロントエンドの utils/payout.ts と揃える
_ACCOUNT_HOLDER_PATTERN = r"^[ァ-ヶー0-9A-Z０-９Ａ-Ｚ 　()（）.．,，\-‐/／「」]+$"
_ACCOUNT_HOLDER_LETTER = re.compile(r"[ァ-ヶA-ZＡ-Ｚ]")


def _require_letter(value: str) -> str:
    if not _ACCOUNT_HOLDER_LETTER.search(value):
        raise PydanticCustomError("account_holder", "口座名義は全角カタカナで入力してください(英字は大文字)")
    return value


class BankAccountInput(BaseModel):
    """主催者の振込先口座の登録・変更"""

    bank_name: TrimmedStr = Field(min_length=1, max_length=BANK_NAME_MAX_LENGTH)
    bank_code: _digits(BANK_CODE_LENGTH)
    branch_name: TrimmedStr = Field(min_length=1, max_length=BANK_NAME_MAX_LENGTH)
    branch_code: _digits(BRANCH_CODE_LENGTH)
    account_type: BankAccountType
    account_number: _digits(ACCOUNT_NUMBER_LENGTH)
    account_holder: Annotated[
        str,
        StringConstraints(
            strip_whitespace=True,
            min_length=1,
            max_length=ACCOUNT_HOLDER_MAX_LENGTH,
            pattern=_ACCOUNT_HOLDER_PATTERN,
        ),
        AfterValidator(_require_letter),
    ]


class BankAccountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    bank_name: str
    bank_code: str
    branch_name: str
    branch_code: str
    account_type: BankAccountType
    account_number: str
    account_holder: str


class PayoutSummary(BaseModel):
    """主催者の売上と振込の状況(円)"""

    # 振込を申請できる額(開催を終えた分の受取額 − 申請中・振込済みの額)
    available_amount: int
    # 開催前で、まだ申請できない受取額(取消・中止で返金になることがある)
    upcoming_amount: int
    # 申請中で、運営の振込を待っている額
    requested_amount: int
    # これまでに振り込まれた額(申請額。振込手数料を含む)
    paid_amount: int
    # 申請できる最低額と、振込手数料
    min_amount: int
    transfer_fee: int
    # いま申請できるか(口座の登録・申請中のものがない・最低額以上)
    can_request: bool
    # 運営側でオンライン決済を使える設定になっているか
    online_payment_available: bool


class EarningRead(BaseModel):
    """主催者の収入の明細(オンライン決済の支払い1件)"""

    payment_id: int
    workshop_id: int
    workshop_title: str
    workshop_end_at: UTCDateTime
    attendee_name: str
    status: PaymentStatus
    amount: int
    # 主催者の受取額。返金になった支払いは 0
    facilitator_amount: int
    # 開催を終えて、振込を申請できる額に入っているか
    settled: bool
    paid_at: UTCDateTime | None


class PayoutRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount: int
    transfer_fee: int
    transfer_amount: int
    status: PayoutRequestStatus
    note: str
    requested_at: UTCDateTime
    processed_at: UTCDateTime | None
    # 申請時の振込先
    bank_account: BankAccountRead


class AdminPayoutRequestRead(PayoutRequestRead):
    """運営向けの振込申請。申請した主催者を含める"""

    facilitator_id: int
    facilitator_name: str
    facilitator_email: str


class PayoutRequestQuery(PageQuery):
    status: PayoutRequestStatus | None = None


class PayoutPaidInput(BaseModel):
    """運営が振込済みにするときのメモ(振込日など。任意)。主催者にも見える"""

    note: TrimmedStr = Field(default="", max_length=PAYOUT_NOTE_MAX_LENGTH)


class PayoutRejectInput(BaseModel):
    """運営が申請を取り下げるときの理由(口座の誤りなど)。主催者が直して申請し直せるよう必須にする"""

    note: TrimmedStr = Field(min_length=1, max_length=PAYOUT_NOTE_MAX_LENGTH)

