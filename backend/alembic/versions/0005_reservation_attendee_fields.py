"""add attendee_name, contact, ticket_count to reservations

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-11

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, Sequence[str], None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "reservations",
        sa.Column("attendee_name", sa.String(length=255), nullable=False, server_default=""),
    )
    op.add_column(
        "reservations",
        sa.Column("contact", sa.String(length=255), nullable=False, server_default=""),
    )
    op.add_column(
        "reservations",
        sa.Column("ticket_count", sa.Integer(), nullable=False, server_default="1"),
    )

    # Backfill existing rows from the reserving user's account info.
    op.execute(
        """
        UPDATE reservations r
        JOIN users u ON r.user_id = u.id
        SET r.attendee_name = u.name, r.contact = u.email
        WHERE r.attendee_name = ''
        """
    )


def downgrade() -> None:
    op.drop_column("reservations", "ticket_count")
    op.drop_column("reservations", "contact")
    op.drop_column("reservations", "attendee_name")
