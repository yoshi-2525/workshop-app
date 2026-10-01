"""add reservation_canceled to notifications.type

Revision ID: 0013
Revises: 0012
Create Date: 2026-09-30

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: Union[str, Sequence[str], None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 主催者による参加のキャンセルを知らせる通知の種類を追加する
    op.alter_column(
        "notifications",
        "type",
        existing_type=sa.Enum("cancellation", "reminder", name="notification_type"),
        type_=sa.Enum("cancellation", "reminder", "reservation_canceled", name="notification_type"),
        existing_nullable=False,
    )


def downgrade() -> None:
    # 追加した種類の通知が残っていると列の型を戻せないので、先に消す
    op.execute("DELETE FROM notifications WHERE type = 'reservation_canceled'")
    op.alter_column(
        "notifications",
        "type",
        existing_type=sa.Enum("cancellation", "reminder", "reservation_canceled", name="notification_type"),
        type_=sa.Enum("cancellation", "reminder", name="notification_type"),
        existing_nullable=False,
    )
