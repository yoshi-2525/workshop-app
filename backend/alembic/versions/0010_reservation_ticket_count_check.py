"""limit reservations.ticket_count to 1-4

Revision ID: 0010
Revises: 0009
Create Date: 2026-09-26

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: Union[str, Sequence[str], None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CONSTRAINT_NAME = "ck_reservation_ticket_count"
# app.models.reservation.MAX_TICKETS_PER_RESERVATION と揃える。
# マイグレーションは適用時点の値で固定したいので、定数は import しない
MAX_TICKETS = 4


def upgrade() -> None:
    # 既存データは書き換えない。範囲外の予約があれば止めて、手動で整理してもらう
    rows = op.get_bind().execute(
        sa.text(
            "SELECT id, ticket_count FROM reservations "
            "WHERE ticket_count < 1 OR ticket_count > :max ORDER BY id"
        ),
        {"max": MAX_TICKETS},
    ).all()
    if rows:
        detail = ", ".join(f"id={r.id} (ticket_count={r.ticket_count})" for r in rows)
        raise RuntimeError(
            f"ticket_count が 1〜{MAX_TICKETS} の範囲外の予約が {len(rows)} 件あります: {detail}。"
            "これらを削除または修正してから、もう一度 alembic upgrade を実行してください。"
        )
    op.create_check_constraint(
        CONSTRAINT_NAME, "reservations", f"ticket_count BETWEEN 1 AND {MAX_TICKETS}"
    )


def downgrade() -> None:
    op.drop_constraint(CONSTRAINT_NAME, "reservations", type_="check")
