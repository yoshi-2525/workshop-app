from datetime import datetime, timezone
from typing import Annotated

from pydantic import AfterValidator, StringConstraints
from pydantic.networks import validate_email
from pydantic_core import PydanticCustomError

# 前後の空白を取り除いてから長さを確かめる文字列。空白だけの入力は min_length=1 で弾ける。
# パスワードのように空白も意味を持つ項目には使わないこと
TrimmedStr = Annotated[str, StringConstraints(strip_whitespace=True)]

# メールアドレスの長さの上限(RFC 5321 の上限。DB の VARCHAR(255) にも収まる)
EMAIL_MAX_LENGTH = 254


def _check_email(value: str) -> str:
    # EmailStr だとエラーメッセージが英語になるので、同じ検証を使って日本語のメッセージにする
    try:
        _, email = validate_email(value)
    except PydanticCustomError:
        raise PydanticCustomError("email", "メールアドレスの形式が正しくありません") from None
    return email


# 前後の空白を取り除き、メールアドレスとして正しいかを確かめる文字列
EmailAddress = Annotated[
    str,
    StringConstraints(strip_whitespace=True, max_length=EMAIL_MAX_LENGTH),
    AfterValidator(_check_email),
]

# The DB stores every datetime as naive UTC. API responses must carry an
# explicit offset so browsers don't read them as local time, and inputs are
# normalized back to naive UTC before they reach the ORM.


def _to_aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _to_naive_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


UTCDateTime = Annotated[datetime, AfterValidator(_to_aware_utc)]
NaiveUTCDateTime = Annotated[datetime, AfterValidator(_to_naive_utc)]
