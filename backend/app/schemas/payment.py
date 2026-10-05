import enum

from pydantic import BaseModel


class PayoutAccountStatus(str, enum.Enum):
    # 受け取り設定をまだ始めていない
    not_registered = "not_registered"
    # 設定の途中、または Stripe の審査中
    pending = "pending"
    # カード決済を受け付けられる
    enabled = "enabled"


class PayoutAccountRead(BaseModel):
    """主催者の参加費の受け取り設定"""

    status: PayoutAccountStatus
    # 運営側でオンライン決済を使える設定になっているか。false なら受け取り設定を始められない
    online_payment_available: bool


class RedirectUrl(BaseModel):
    """Stripe の画面へ移動する URL"""

    url: str
