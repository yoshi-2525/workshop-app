"""add participant guide / emergency contact to workshops and attendance to reservations

Revision ID: 0016
Revises: 0015
Create Date: 2026-10-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: Union[str, Sequence[str], None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 予約した参加者にだけ見せる当日の案内と緊急連絡先。開催前日のリマインダーにも載せる
    op.add_column(
        "workshops",
        sa.Column("participant_guide", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "workshops",
        sa.Column("emergency_contact", sa.String(length=255), nullable=False, server_default=""),
    )
    # 開催当日に主催者が記録する出欠
    op.add_column(
        "reservations",
        sa.Column(
            "attendance",
            sa.Enum("unconfirmed", "present", "absent", name="attendance_status"),
            nullable=False,
            server_default="unconfirmed",
        ),
    )


def downgrade() -> None:
    op.drop_column("reservations", "attendance")
    op.drop_column("workshops", "emergency_contact")
    op.drop_column("workshops", "participant_guide")
