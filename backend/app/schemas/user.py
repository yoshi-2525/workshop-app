from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from pydantic_core import PydanticCustomError

from app.core.security import BCRYPT_MAX_BYTES
from app.models.user import UserRole
from app.schemas.types import TrimmedStr

# Self-registration is limited to these two roles. "admin" is granted only
# via the set_role.py script, never through the public API.
SelfRegisterRole = Literal[UserRole.facilitator, UserRole.participant]


class UserRegister(BaseModel):
    name: TrimmedStr = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=BCRYPT_MAX_BYTES)
    role: SelfRegisterRole = UserRole.participant

    @field_validator("password")
    @classmethod
    def check_password_bytes(cls, value: str) -> str:
        # bcrypt は 72 バイトより後ろを無視するので、黙って切り捨てずに弾く(日本語などは1文字3バイト)
        if len(value.encode("utf-8")) > BCRYPT_MAX_BYTES:
            raise PydanticCustomError(
                "password_too_long",
                "パスワードは {max_bytes} バイト以内にしてください(英数字なら {max_bytes} 文字まで)",
                {"max_bytes": BCRYPT_MAX_BYTES},
            )
        return value


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    role: UserRole
    bio: str
    avatar_url: str


class UserUpdate(BaseModel):
    name: TrimmedStr | None = Field(default=None, min_length=1, max_length=255)
    bio: TrimmedStr | None = Field(default=None, max_length=2000)


class FacilitatorProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    bio: str
    role: UserRole
    avatar_url: str
