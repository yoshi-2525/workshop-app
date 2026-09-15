from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole

# Self-registration is limited to these two roles. "admin" is granted only
# via the set_role.py script, never through the public API.
SelfRegisterRole = Literal[UserRole.facilitator, UserRole.participant]


class UserRegister(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: SelfRegisterRole = UserRole.participant


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    role: UserRole
    bio: str


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    bio: str | None = Field(default=None, max_length=2000)


class FacilitatorProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    bio: str
    role: UserRole
