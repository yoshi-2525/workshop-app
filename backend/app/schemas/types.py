from datetime import datetime, timezone
from typing import Annotated

from pydantic import AfterValidator, StringConstraints

# 前後の空白を取り除いてから長さを確かめる文字列。空白だけの入力は min_length=1 で弾ける。
# パスワードのように空白も意味を持つ項目には使わないこと
TrimmedStr = Annotated[str, StringConstraints(strip_whitespace=True)]

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
