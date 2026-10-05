"""add online payment (Stripe Connect)

Revision ID: 0018
Revises: 0017
Create Date: 2026-10-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0018"
down_revision: Union[str, Sequence[str], None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OLD_RESERVATION_STATUSES = ("confirmed", "canceled")
_NEW_RESERVATION_STATUSES = (*_OLD_RESERVATION_STATUSES, "pending_payment", "expired")

_OLD_NOTIFICATION_TYPES = ("cancellation", "reminder", "reservation_canceled", "new_workshop")
_NEW_NOTIFICATION_TYPES = (*_OLD_NOTIFICATION_TYPES, "payment_refunded")


def upgrade() -> None:
    # 主催者が参加費を受け取る Stripe の連結アカウント
    op.add_column("users", sa.Column("stripe_account_id", sa.String(255), nullable=True))
    op.create_unique_constraint("uq_users_stripe_account_id", "users", ["stripe_account_id"])
    op.add_column(
        "users",
        sa.Column("stripe_charges_enabled", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )

    # 既存のワークショップは当日払いのまま
    op.add_column(
        "workshops",
        sa.Column(
            "payment_method",
            sa.Enum("onsite", "online", name="payment_method"),
            nullable=False,
            server_default="onsite",
        ),
    )

    # 支払い待ちの席の確保と、主催者が取り消した理由
    op.alter_column(
        "reservations",
        "status",
        existing_type=sa.Enum(*_OLD_RESERVATION_STATUSES, name="reservation_status"),
        type_=sa.Enum(*_NEW_RESERVATION_STATUSES, name="reservation_status"),
        existing_nullable=False,
        # MySQL では型の変更が MODIFY になり、指定しないと既定値が消える
        existing_server_default="confirmed",
    )
    op.add_column("reservations", sa.Column("payment_expires_at", sa.DateTime(), nullable=True))
    op.add_column(
        "reservations",
        sa.Column("cancel_reason", sa.Enum("participant", "facilitator", name="cancel_reason"), nullable=True),
    )

    op.create_table(
        "payments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("reservation_id", sa.Integer(), sa.ForeignKey("reservations.id"), nullable=False),
        sa.Column("stripe_account_id", sa.String(255), nullable=False),
        sa.Column("stripe_checkout_session_id", sa.String(255), nullable=True),
        sa.Column("stripe_payment_intent_id", sa.String(255), nullable=True),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("application_fee_amount", sa.Integer(), nullable=False),
        sa.Column("stripe_fee_amount", sa.Integer(), nullable=True),
        sa.Column("refund_amount", sa.Integer(), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "pending", "paid", "expired", "refund_pending", "refunded", "refund_failed", name="payment_status"
            ),
            nullable=False,
        ),
        sa.Column("refund_attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("paid_at", sa.DateTime(), nullable=True),
        sa.Column("refunded_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("stripe_checkout_session_id", name="uq_payments_stripe_checkout_session_id"),
        sa.UniqueConstraint("stripe_payment_intent_id", name="uq_payments_stripe_payment_intent_id"),
        sa.CheckConstraint("amount > 0", name="ck_payments_amount"),
        sa.CheckConstraint(
            "application_fee_amount >= 0 AND application_fee_amount <= amount", name="ck_payments_application_fee"
        ),
        sa.CheckConstraint(
            "refund_amount IS NULL OR (refund_amount >= 0 AND refund_amount <= amount)", name="ck_payments_refund"
        ),
        sa.CheckConstraint("refund_attempts >= 0", name="ck_payments_refund_attempts"),
    )
    op.create_index("ix_payments_reservation_id", "payments", ["reservation_id"])

    # 処理した Webhook イベント(再送を二重に処理しないため)
    op.create_table(
        "stripe_events",
        sa.Column("event_id", sa.String(255), primary_key=True),
        sa.Column("type", sa.String(255), nullable=False),
        sa.Column("received_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    # 返金の完了を知らせる通知の種類
    op.alter_column(
        "notifications",
        "type",
        existing_type=sa.Enum(*_OLD_NOTIFICATION_TYPES, name="notification_type"),
        type_=sa.Enum(*_NEW_NOTIFICATION_TYPES, name="notification_type"),
        existing_nullable=False,
    )


def downgrade() -> None:
    # 追加した値の行が残っていると列の型を戻せないので、先に消す・戻す
    op.execute("DELETE FROM notifications WHERE type = 'payment_refunded'")
    op.alter_column(
        "notifications",
        "type",
        existing_type=sa.Enum(*_NEW_NOTIFICATION_TYPES, name="notification_type"),
        type_=sa.Enum(*_OLD_NOTIFICATION_TYPES, name="notification_type"),
        existing_nullable=False,
    )
    op.drop_table("stripe_events")
    # ix_payments_reservation_id は外部キーが使っているので単独では消せない。テーブルごと消す
    op.drop_table("payments")
    op.drop_column("reservations", "cancel_reason")
    op.drop_column("reservations", "payment_expires_at")
    op.execute("UPDATE reservations SET status = 'canceled' WHERE status IN ('pending_payment', 'expired')")
    op.alter_column(
        "reservations",
        "status",
        existing_type=sa.Enum(*_NEW_RESERVATION_STATUSES, name="reservation_status"),
        type_=sa.Enum(*_OLD_RESERVATION_STATUSES, name="reservation_status"),
        existing_nullable=False,
        existing_server_default="confirmed",
    )
    op.drop_column("workshops", "payment_method")
    op.drop_column("users", "stripe_charges_enabled")
    op.drop_constraint("uq_users_stripe_account_id", "users", type_="unique")
    op.drop_column("users", "stripe_account_id")
