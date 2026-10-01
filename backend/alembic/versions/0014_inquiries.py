"""add inquiries and inquiry_messages tables

Revision ID: 0014
Revises: 0013
Create Date: 2026-10-01

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: Union[str, Sequence[str], None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 参加者から主催者への問い合わせ。ワークショップと参加者の組み合わせごとに1つ
    op.create_table(
        "inquiries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("workshop_id", sa.Integer(), sa.ForeignKey("workshops.id"), nullable=False),
        sa.Column("participant_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("last_message_at", sa.DateTime(), nullable=False),
        sa.Column("participant_last_read_id", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("facilitator_last_read_id", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("workshop_id", "participant_id", name="uq_inquiry_workshop_participant"),
    )
    op.create_table(
        "inquiry_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("inquiry_id", sa.Integer(), sa.ForeignKey("inquiries.id"), nullable=False),
        sa.Column("sender_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_inquiry_messages_inquiry_id", "inquiry_messages", ["inquiry_id"])


def downgrade() -> None:
    op.drop_index("ix_inquiry_messages_inquiry_id", table_name="inquiry_messages")
    op.drop_table("inquiry_messages")
    op.drop_table("inquiries")
