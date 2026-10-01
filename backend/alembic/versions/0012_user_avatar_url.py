"""add users.avatar_url

Revision ID: 0012
Revises: 0011
Create Date: 2026-09-30

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: Union[str, Sequence[str], None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("avatar_url", sa.String(length=2000), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("users", "avatar_url")
