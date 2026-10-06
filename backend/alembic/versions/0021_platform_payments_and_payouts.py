"""platform payments and facilitator payouts (drop Stripe Connect)

Revision ID: 0021
Revises: 0020
Create Date: 2026-10-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0021"
down_revision: Union[str, Sequence[str], None] = "0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_ACCOUNT_TYPES = ("ordinary", "checking")


def _bank_account_columns() -> list[sa.Column]:
    return [
        sa.Column("bank_name", sa.String(100), nullable=False),
        sa.Column("bank_code", sa.String(4), nullable=False),
        sa.Column("branch_name", sa.String(100), nullable=False),
        sa.Column("branch_code", sa.String(3), nullable=False),
        sa.Column("account_type", sa.Enum(*_ACCOUNT_TYPES, name="bank_account_type"), nullable=False),
        sa.Column("account_number", sa.String(7), nullable=False),
        sa.Column("account_holder", sa.String(100), nullable=False),
    ]


def upgrade() -> None:
    # Connect(direct charge)で受け取った支払いは、参加費がすでに主催者の連結アカウントに入っている。
    # 残したまま移行すると主催者の残高に入って二重に振り込まれ、返金も運営のアカウントからはできないので、先に精算させる
    legacy = op.get_bind().execute(
        sa.text("SELECT COUNT(*) FROM payments WHERE status IN ('pending', 'paid', 'refund_pending')")
    ).scalar()
    if legacy:
        raise RuntimeError(
            "連結アカウントで受け取った支払い(支払い待ち・支払い済み・返金待ち)が残っています。"
            "主催者の残高に二重に入るため、Stripe 側で精算・返金してから移行してください"
        )

    # 参加費は運営の Stripe アカウントで決済し、主催者には運営が振り込む。主催者ごとの連結アカウントは使わない
    op.drop_constraint("uq_users_stripe_account_id", "users", type_="unique")
    op.drop_column("users", "stripe_account_id")
    op.drop_column("users", "stripe_charges_enabled")

    op.drop_column("payments", "stripe_account_id")
    # Connect の application fee ではなくなったので、運営の手数料として名前を変える
    op.drop_constraint("ck_payments_application_fee", "payments", type_="check")
    op.alter_column(
        "payments",
        "application_fee_amount",
        new_column_name="platform_fee_amount",
        existing_type=sa.Integer(),
        existing_nullable=False,
    )
    op.create_check_constraint(
        "ck_payments_platform_fee", "payments", "platform_fee_amount >= 0 AND platform_fee_amount <= amount"
    )
    # 主催者の受取額。既存の行は参加費から運営の手数料を引いた額にする
    op.add_column("payments", sa.Column("facilitator_amount", sa.Integer(), nullable=False, server_default="0"))
    op.execute("UPDATE payments SET facilitator_amount = amount - platform_fee_amount")
    op.alter_column(
        "payments", "facilitator_amount", existing_type=sa.Integer(), existing_nullable=False, server_default=None
    )
    op.create_check_constraint(
        "ck_payments_facilitator_amount",
        "payments",
        "facilitator_amount >= 0 AND facilitator_amount + platform_fee_amount = amount",
    )

    op.create_table(
        "payout_bank_accounts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        *_bank_account_columns(),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("user_id", name="uq_payout_bank_accounts_user_id"),
    )

    op.create_table(
        "payout_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("facilitator_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("transfer_fee", sa.Integer(), nullable=False),
        sa.Column("transfer_amount", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("requested", "paid", "rejected", name="payout_request_status"),
            nullable=False,
        ),
        *_bank_account_columns(),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("requested_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("processed_at", sa.DateTime(), nullable=True),
        sa.CheckConstraint("amount > 0", name="ck_payout_requests_amount"),
        sa.CheckConstraint(
            "transfer_fee >= 0 AND transfer_amount > 0 AND transfer_amount + transfer_fee = amount",
            name="ck_payout_requests_transfer",
        ),
    )
    op.create_index("ix_payout_requests_facilitator_id", "payout_requests", ["facilitator_id"])


def downgrade() -> None:
    # 振込の記録と口座は消える。連結アカウントの ID は戻らない(空にする)
    op.drop_table("payout_requests")
    op.drop_table("payout_bank_accounts")

    op.drop_constraint("ck_payments_facilitator_amount", "payments", type_="check")
    op.drop_column("payments", "facilitator_amount")
    op.drop_constraint("ck_payments_platform_fee", "payments", type_="check")
    op.alter_column(
        "payments",
        "platform_fee_amount",
        new_column_name="application_fee_amount",
        existing_type=sa.Integer(),
        existing_nullable=False,
    )
    op.create_check_constraint(
        "ck_payments_application_fee", "payments", "application_fee_amount >= 0 AND application_fee_amount <= amount"
    )
    op.add_column("payments", sa.Column("stripe_account_id", sa.String(255), nullable=False, server_default=""))
    op.alter_column(
        "payments", "stripe_account_id", existing_type=sa.String(255), existing_nullable=False, server_default=None
    )

    op.add_column(
        "users",
        sa.Column("stripe_charges_enabled", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column("users", sa.Column("stripe_account_id", sa.String(255), nullable=True))
    op.create_unique_constraint("uq_users_stripe_account_id", "users", ["stripe_account_id"])
