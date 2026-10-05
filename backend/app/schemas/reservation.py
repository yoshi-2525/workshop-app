from pydantic import BaseModel, ConfigDict, Field

from app.models.payment import PaymentStatus
from app.models.reservation import MAX_TICKETS_PER_RESERVATION, AttendanceStatus, ReservationStatus
from app.schemas.types import EmailAddress, UTCDateTime
from app.schemas.workshop import WorkshopRead


class ReservationCreate(BaseModel):
    # 主催者から参加者への連絡に使うメールアドレス(項目名は以前の「連絡先」のまま)
    contact: EmailAddress
    ticket_count: int = Field(ge=1, le=MAX_TICKETS_PER_RESERVATION, default=1)


class PaymentSummary(BaseModel):
    """予約の最新の支払い(オンライン決済のときだけ)"""

    status: PaymentStatus
    amount: int
    # 手数料の内訳(主催者が負担する)。主催者・運営にだけ返し、参加者には null
    application_fee_amount: int | None
    # 支払いが済むまでと、参加者には null
    stripe_fee_amount: int | None
    # 返金が決まるまでは null
    refund_amount: int | None


class ReservationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    workshop_id: int
    workshop: WorkshopRead
    user_id: int
    user_name: str
    attendee_name: str
    contact: str
    ticket_count: int
    status: ReservationStatus
    attendance: AttendanceStatus
    # 支払い待ちの席を確保している期限。支払い待ちでなければ null
    payment_expires_at: UTCDateTime | None = None
    # オンライン決済でなければ null
    payment: PaymentSummary | None = None
    created_at: UTCDateTime


class ReservationCreateResult(BaseModel):
    reservation: ReservationRead
    # オンライン決済のとき、移動する Stripe の支払い画面の URL。当日払いなら null(予約はこの時点で確定)
    checkout_url: str | None = None


class AttendanceUpdate(BaseModel):
    attendance: AttendanceStatus
