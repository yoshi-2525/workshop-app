from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.workshop import LocationType, WorkshopStatus


class WorkshopInput(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    location_type: LocationType = LocationType.offline
    location: str = Field(min_length=1, max_length=255)
    start_at: datetime
    end_at: datetime
    capacity: int = Field(ge=1, le=10000)
    price: int = Field(ge=0, le=10_000_000, default=0)
    cancellation_policy: str = Field(default="", max_length=2000)
    status: WorkshopStatus = WorkshopStatus.draft

    @model_validator(mode="after")
    def check_dates(self) -> "WorkshopInput":
        if self.end_at <= self.start_at:
            raise ValueError("end_at must be after start_at")
        return self


class WorkshopRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    image_url: str
    location_type: LocationType
    location: str
    start_at: datetime
    end_at: datetime
    capacity: int
    price: int
    cancellation_policy: str
    status: WorkshopStatus
    facilitator_id: int
    facilitator_name: str
    reserved_count: int
    is_favorited: bool = False
    is_reserved: bool = False
