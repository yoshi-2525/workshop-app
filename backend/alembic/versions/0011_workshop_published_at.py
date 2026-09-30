"""add workshops.published_at

Revision ID: 0011
Revises: 0010
Create Date: 2026-09-26

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: Union[str, Sequence[str], None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("workshops", sa.Column("published_at", sa.DateTime(), nullable=True))
    # 既存の公開中データは実際の公開日時が分からないため、作成日時で補完する
    op.execute("UPDATE workshops SET published_at = created_at WHERE status = 'published'")


def downgrade() -> None:
    op.drop_column("workshops", "published_at")
