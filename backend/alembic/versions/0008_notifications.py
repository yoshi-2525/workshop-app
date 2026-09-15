"""add notifications table

Revision ID: 0008
Revises: 0007
Create Date: 2026-09-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: Union[str, Sequence[str], None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("workshop_id", sa.Integer(), sa.ForeignKey("workshops.id"), nullable=False),
        sa.Column(
            "type",
            sa.Enum("cancellation", "reminder", name="notification_type"),
            nullable=False,
        ),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint(
            "user_id", "workshop_id", "type", name="uq_notification_user_workshop_type"
        ),
    )


def downgrade() -> None:
    op.drop_table("notifications")
