"""add cancellation_policy to workshops

Revision ID: 0006
Revises: 0005
Create Date: 2026-09-11

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, Sequence[str], None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "workshops",
        sa.Column("cancellation_policy", sa.Text(), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("workshops", "cancellation_policy")
