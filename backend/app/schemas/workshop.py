from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic_core import PydanticCustomError

from app.models.workshop import LocationType, WorkshopStatus
from app.schemas.pagination import PageQuery
from app.schemas.types import NaiveUTCDateTime, TrimmedStr, UTCDateTime


# 入力の上限。フロントエンドの utils/workshop.ts と揃える
TITLE_MAX_LENGTH = 50
CAPACITY_MAX = 100
PRICE_MAX = 100_000
PARTICIPANT_GUIDE_MAX_LENGTH = 2000
EMERGENCY_CONTACT_MAX_LENGTH = 255


class WorkshopInput(BaseModel):
    title: TrimmedStr = Field(min_length=1, max_length=TITLE_MAX_LENGTH)
    description: TrimmedStr = Field(min_length=1, max_length=1000)
    location_type: LocationType = LocationType.offline
    location: TrimmedStr = Field(min_length=1, max_length=255)
    start_at: NaiveUTCDateTime
    end_at: NaiveUTCDateTime
    capacity: int = Field(ge=1, le=CAPACITY_MAX)
    price: int = Field(ge=0, le=PRICE_MAX, default=0)
    cancellation_policy: TrimmedStr = Field(default="", max_length=2000)
    participant_guide: TrimmedStr = Field(default="", max_length=PARTICIPANT_GUIDE_MAX_LENGTH)
    emergency_contact: TrimmedStr = Field(default="", max_length=EMERGENCY_CONTACT_MAX_LENGTH)
    status: WorkshopStatus = WorkshopStatus.draft

    @model_validator(mode="after")
    def check_dates(self) -> "WorkshopInput":
        if self.end_at <= self.start_at:
            raise ValueError("end_at must be after start_at")
        return self


class WorkshopViewer(BaseModel):
    """閲覧者(リクエストしたユーザー)によって値が変わる項目"""

    is_favorited: bool = False
    is_reserved: bool = False
    # 主催者に参加をキャンセルされた。この場合は同じワークショップを再予約できない
    is_reservation_canceled: bool = False


class ParticipantInfo(BaseModel):
    """予約した参加者と主催者(と運営)にだけ返す、参加者向けの案内"""

    guide: str
    emergency_contact: str


class WorkshopRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    image_url: str
    location_type: LocationType
    location: str
    start_at: UTCDateTime
    end_at: UTCDateTime
    capacity: int
    price: int
    cancellation_policy: str
    status: WorkshopStatus
    facilitator_id: int
    facilitator_name: str
    facilitator_avatar_url: str
    reserved_count: int
    viewer: WorkshopViewer = WorkshopViewer()
    # 閲覧者が予約済みの参加者・主催者・運営でなければ null
    participant_info: ParticipantInfo | None = None


class RelatedWorkshops(BaseModel):
    """ワークショップ詳細ページに出す関連ワークショップ(GET /api/workshops/{id}/related)"""

    # 同じ主催者が開催するもの
    same_facilitator: list[WorkshopRead]
    # タイトル・説明が似ているもの
    similar: list[WorkshopRead]
    # オフライン開催: 会場が近いもの / オンライン開催: 他のオンライン開催のもの
    nearby: list[WorkshopRead]


class WorkshopSearchQuery(PageQuery):
    """公開ワークショップ一覧(GET /api/workshops)の検索条件。URL のクエリパラメータから組み立てる。

    一覧に出るのは、どの条件でも公開中かつ開始前のものだけ。
    ページ指定(limit / offset)と、存在しないパラメータを 422 にする設定は PageQuery から引き継ぐ
    """

    facilitator_id: int | None = None
    q: str | None = Field(default=None, max_length=100)
    location_type: LocationType | None = None
    price: Literal["free", "paid"] | None = None
    # price=paid のときだけ使う
    max_price: int | None = Field(default=None, ge=0)
    # 予約できる(満員でなく、予約の締め切り前の)ものだけ
    available: bool = False
    # ログイン中のユーザーが予約済み(確定済み)のものを除く。未ログインなら何もしない
    exclude_reserved: bool = False
    # ログイン中のユーザーが主催するものを除く。未ログインなら何もしない
    exclude_own: bool = False
    # 開催日時の範囲 [start_from, start_to)。「今日」などの日付の区切りは利用者の時間帯で決まるため、
    # 範囲の計算はフロントエンドで行い、API は受け取った範囲で絞り込むだけにする
    start_from: NaiveUTCDateTime | None = None
    start_to: NaiveUTCDateTime | None = None
    sort: Literal["start", "newest", "price"] = "start"

    @model_validator(mode="after")
    def check_start_range(self) -> "WorkshopSearchQuery":
        if self.start_from is not None and self.start_to is not None and self.start_from >= self.start_to:
            # ValueError だとメッセージの先頭に "Value error, " が付くので、専用のエラーにする
            raise PydanticCustomError("start_range", "start_to は start_from より後の日時を指定してください")
        return self
