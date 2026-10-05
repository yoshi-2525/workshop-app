"""add facilitator_follows and new_workshop to notifications.type

Revision ID: 0017
Revises: 0016
Create Date: 2026-10-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: Union[str, Sequence[str], None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OLD_TYPES = ("cancellation", "reminder", "reservation_canceled")
_NEW_TYPES = (*_OLD_TYPES, "new_workshop")


def upgrade() -> None:
    # ユーザーが主催者をフォローする
    op.create_table(
        "facilitator_follows",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("follower_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("facilitator_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("follower_id", "facilitator_id", name="uq_follow_follower_facilitator"),
    )
    op.create_index("ix_facilitator_follows_facilitator_id", "facilitator_follows", ["facilitator_id"])

    # フォロー中の主催者が新しいワークショップを公開したことを知らせる通知の種類を追加する
    op.alter_column(
        "notifications",
        "type",
        existing_type=sa.Enum(*_OLD_TYPES, name="notification_type"),
        type_=sa.Enum(*_NEW_TYPES, name="notification_type"),
        existing_nullable=False,
    )


def downgrade() -> None:
    # 追加した種類の通知が残っていると列の型を戻せないので、先に消す
    op.execute("DELETE FROM notifications WHERE type = 'new_workshop'")
    op.alter_column(
        "notifications",
        "type",
        existing_type=sa.Enum(*_NEW_TYPES, name="notification_type"),
        type_=sa.Enum(*_OLD_TYPES, name="notification_type"),
        existing_nullable=False,
    )
    op.drop_index("ix_facilitator_follows_facilitator_id", table_name="facilitator_follows")
    op.drop_table("facilitator_follows")
