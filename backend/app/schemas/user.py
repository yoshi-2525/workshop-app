import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from pydantic_core import PydanticCustomError

from app.core.security import BCRYPT_MAX_BYTES
from app.models.user import UserRole
from app.schemas.types import TrimmedStr

# Self-registration is limited to these two roles. "admin" is granted only
# via the set_role.py script, never through the public API.
SelfRegisterRole = Literal[UserRole.facilitator, UserRole.participant]

# パスワードに使える文字。フロントエンドの utils/user.ts の PASSWORD_PATTERN と揃える
_PASSWORD_PATTERN = re.compile(r"[\x21-\x7e]+")


class UserRegister(BaseModel):
    name: TrimmedStr = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=BCRYPT_MAX_BYTES)
    role: SelfRegisterRole = UserRole.participant

    @field_validator("password")
    @classmethod
    def check_password_characters(cls, value: str) -> str:
        # 半角英数字と記号(スペースを除く ASCII の印字可能文字)だけを受け付ける。
        # 1文字が必ず1バイトになるので、文字数の上限(max_length)がそのまま bcrypt の 72 バイトの上限と一致する
        if not _PASSWORD_PATTERN.fullmatch(value):
            raise PydanticCustomError(
                "password_invalid_characters",
                "パスワードは半角英数字と記号で入力してください(全角文字・スペースは使えません)",
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
