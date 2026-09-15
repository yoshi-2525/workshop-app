"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-09-10

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column(
            "role",
            sa.Enum("admin", "facilitator", "participant", name="user_role"),
            nullable=False,
            server_default="participant",
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "workshops",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=False),
        sa.Column("start_at", sa.DateTime(), nullable=False),
        sa.Column("end_at", sa.DateTime(), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False, server_default="10"),
        sa.Column(
            "status",
            sa.Enum("draft", "published", "canceled", name="workshop_status"),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("facilitator_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    op.create_table(
        "reservations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("workshop_id", sa.Integer(), sa.ForeignKey("workshops.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "status",
            sa.Enum("confirmed", "canceled", name="reservation_status"),
            nullable=False,
            server_default="confirmed",
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("workshop_id", "user_id", name="uq_reservation_workshop_user"),
    )


def downgrade() -> None:
    op.drop_table("reservations")
    op.drop_table("workshops")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
