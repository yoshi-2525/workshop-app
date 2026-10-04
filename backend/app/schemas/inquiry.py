from typing import Literal

from pydantic import BaseModel, Field

from app.models.inquiry import INQUIRY_MESSAGE_MAX_LENGTH
from app.schemas.types import TrimmedStr, UTCDateTime

# 閲覧しているユーザーが、その問い合わせのどちら側か
InquiryRole = Literal["participant", "facilitator"]


class InquiryMessageCreate(BaseModel):
    body: TrimmedStr = Field(min_length=1, max_length=INQUIRY_MESSAGE_MAX_LENGTH)


class InquiryMessageRead(BaseModel):
    id: int
    sender_id: int
    sender_name: str
    # 閲覧しているユーザー自身が送ったメッセージか
    is_mine: bool
    body: str
    # 主催者が参加者全員に一斉送信したお知らせか
    is_broadcast: bool
    created_at: UTCDateTime


class InquiryBroadcastResult(BaseModel):
    # お知らせを届けた参加者の人数
    sent_count: int


class InquirySummary(BaseModel):
    """一覧用。メッセージ本文は最後の1通だけを持つ"""

    id: int
    workshop_id: int
    workshop_title: str
    my_role: InquiryRole
    # やり取りの相手(参加者から見れば主催者、主催者から見れば参加者)
    counterpart_id: int
    counterpart_name: str
    counterpart_avatar_url: str
    last_message: str
    last_message_at: UTCDateTime
    unread_count: int


class InquiryDetail(InquirySummary):
    messages: list[InquiryMessageRead]
