"""drop reservations.attendee_name

Revision ID: 0022
Revises: 0021
Create Date: 2026-10-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0022"
down_revision: Union[str, Sequence[str], None] = "0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 参加者名は入力させず予約時のアカウント名を写していただけなので、予約者(users.name)を参照する形にする
    op.drop_column("reservations", "attendee_name")


def downgrade() -> None:
    # 列は戻すが、予約時点の名前は戻らない(今のアカウント名で埋める)
    op.add_column(
        "reservations",
        sa.Column("attendee_name", sa.String(length=255), nullable=False, server_default=""),
    )
    op.execute(
        """
        UPDATE reservations r
        JOIN users u ON u.id = r.user_id
        SET r.attendee_name = u.name
        """
    )
