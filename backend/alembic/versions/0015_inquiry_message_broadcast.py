"""add is_broadcast to inquiry_messages

Revision ID: 0015
Revises: 0014
Create Date: 2026-10-02

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: Union[str, Sequence[str], None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 主催者が参加者全員に一斉送信したお知らせか。参加者の画面で個別の返信と区別して表示する
    op.add_column(
        "inquiry_messages",
        sa.Column("is_broadcast", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("inquiry_messages", "is_broadcast")
