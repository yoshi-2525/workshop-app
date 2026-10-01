from pydantic import BaseModel, ConfigDict, Field

from app.models.reservation import MAX_TICKETS_PER_RESERVATION, ReservationStatus
from app.schemas.types import EmailAddress, TrimmedStr, UTCDateTime
from app.schemas.workshop import WorkshopRead


class ReservationCreate(BaseModel):
    attendee_name: TrimmedStr = Field(min_length=1, max_length=255)
    # 主催者から参加者への連絡に使うメールアドレス(項目名は以前の「連絡先」のまま)
    contact: EmailAddress
    ticket_count: int = Field(ge=1, le=MAX_TICKETS_PER_RESERVATION, default=1)


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
    created_at: UTCDateTime
