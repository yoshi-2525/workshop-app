"""add payments.stripe_refund_id and payment_refund_failed to notifications.type

Revision ID: 0019
Revises: 0018
Create Date: 2026-10-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0019"
down_revision: Union[str, Sequence[str], None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OLD_TYPES = ("cancellation", "reminder", "reservation_canceled", "new_workshop", "payment_refunded")
_NEW_TYPES = (*_OLD_TYPES, "payment_refund_failed")


def upgrade() -> None:
    # Stripe の返金の ID。運営の手動対応や、Stripe 側の返金との照合に使う
    op.add_column("payments", sa.Column("stripe_refund_id", sa.String(255), nullable=True))
    # 返金が Stripe 側で失敗したことを参加者に知らせる通知の種類
    op.alter_column(
        "notifications",
        "type",
        existing_type=sa.Enum(*_OLD_TYPES, name="notification_type"),
        type_=sa.Enum(*_NEW_TYPES, name="notification_type"),
        existing_nullable=False,
    )


def downgrade() -> None:
    # 追加した種類の通知が残っていると列の型を戻せないので、先に消す
    op.execute("DELETE FROM notifications WHERE type = 'payment_refund_failed'")
    op.alter_column(
        "notifications",
        "type",
        existing_type=sa.Enum(*_NEW_TYPES, name="notification_type"),
        type_=sa.Enum(*_OLD_TYPES, name="notification_type"),
        existing_nullable=False,
    )
    op.drop_column("payments", "stripe_refund_id")
