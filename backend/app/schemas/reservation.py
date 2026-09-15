from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.reservation import ReservationStatus
from app.schemas.workshop import WorkshopRead


class ReservationCreate(BaseModel):
    attendee_name: str = Field(min_length=1, max_length=255)
    contact: str = Field(min_length=1, max_length=255)
    ticket_count: int = Field(ge=1, le=20, default=1)


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
    created_at: datetime
