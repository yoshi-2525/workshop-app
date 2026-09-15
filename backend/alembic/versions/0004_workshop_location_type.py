"""add location_type to workshops

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-11

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, Sequence[str], None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "workshops",
        sa.Column(
            "location_type",
            sa.Enum("online", "offline", name="location_type"),
            nullable=False,
            server_default="offline",
        ),
    )


def downgrade() -> None:
    op.drop_column("workshops", "location_type")
