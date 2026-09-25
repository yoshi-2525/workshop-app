"""make created_at NOT NULL

Revision ID: 0009
Revises: 0008
Create Date: 2026-09-25

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: Union[str, Sequence[str], None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ("users", "workshops", "reservations", "favorites", "notifications")


def _alter_created_at(nullable: bool) -> None:
    for table in TABLES:
        op.alter_column(
            table,
            "created_at",
            existing_type=sa.DateTime(),
            existing_server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=nullable,
        )


def upgrade() -> None:
    for table in TABLES:
        op.execute(f"UPDATE {table} SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL")
    _alter_created_at(nullable=False)


def downgrade() -> None:
    _alter_created_at(nullable=True)
