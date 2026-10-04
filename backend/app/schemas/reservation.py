from pydantic import BaseModel, ConfigDict, Field

from app.models.reservation import MAX_TICKETS_PER_RESERVATION, AttendanceStatus, ReservationStatus
from app.schemas.types import EmailAddress, UTCDateTime
from app.schemas.workshop import WorkshopRead


class ReservationCreate(BaseModel):
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
    attendance: AttendanceStatus
    created_at: UTCDateTime


class AttendanceUpdate(BaseModel):
    attendance: AttendanceStatus
