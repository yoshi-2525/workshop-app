"""drop workshops.cancellation_policy

Revision ID: 0020
Revises: 0019
Create Date: 2026-10-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0020"
down_revision: Union[str, Sequence[str], None] = "0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 主催者ごとのキャンセルポリシー(自由記述)をやめ、キャンセルと返金は本サービスのキャンセルポリシーにそろえる。
    # オンライン決済の返金額に主催者のキャンセル料を反映できず、記載と実際の返金額が食い違うため
    op.drop_column("workshops", "cancellation_policy")


def downgrade() -> None:
    # 列は戻すが、削除した文章は戻らない(空文字になる)
    op.add_column(
        "workshops",
        sa.Column("cancellation_policy", sa.Text(), nullable=False, server_default=""),
    )
