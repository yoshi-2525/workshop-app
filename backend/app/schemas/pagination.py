from pydantic import BaseModel, ConfigDict, Field


class PageQuery(BaseModel):
    """一覧 API 共通のページ指定。limit を指定したときだけページ分けし、総件数を X-Total-Count で返す"""

    # 存在しないパラメータ(打ち間違いや廃止済みのもの)は黙って無視せず 422 にする
    model_config = ConfigDict(extra="forbid")

    limit: int | None = Field(default=None, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
