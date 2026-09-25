from pydantic import BaseModel, ConfigDict

from app.models.notification import NotificationType
from app.schemas.types import UTCDateTime


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    workshop_id: int
    workshop_title: str
    type: NotificationType
    message: str
    is_read: bool
    created_at: UTCDateTime
