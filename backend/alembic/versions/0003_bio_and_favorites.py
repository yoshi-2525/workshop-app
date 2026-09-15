"""add user bio and favorites table

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-10

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, Sequence[str], None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("bio", sa.Text(), nullable=False, server_default=""),
    )

    op.create_table(
        "favorites",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("workshop_id", sa.Integer(), sa.ForeignKey("workshops.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("user_id", "workshop_id", name="uq_favorite_user_workshop"),
    )


def downgrade() -> None:
    op.drop_table("favorites")
    op.drop_column("users", "bio")
