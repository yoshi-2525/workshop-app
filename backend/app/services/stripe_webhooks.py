"""Stripe の Webhook イベントの反映。

決済は主催者の連結アカウント上で行うので、Checkout のイベントは Connect 用のエンドポイントに届き、
event["account"] に主催者の連結アカウントが入る。
"""

import logging
from typing import Any

from sqlalchemy.orm import Session

from app.core import stripe_client
from app.models.stripe_event import StripeEvent
from app.services.payments import apply_account_state, find_payment_by_session, mark_refund_failed
from app.services.reservations import apply_checkout_state

logger = logging.getLogger(__name__)

_CHECKOUT_EVENTS = ("checkout.session.completed", "checkout.session.expired")


def _apply_checkout_event(db: Session, event: dict[str, Any]) -> None:
    session = event["data"]["object"]
    payment = find_payment_by_session(db, session["id"])
    if payment is None:
        # このアプリ以外で作られた Checkout(同じ連結アカウントを別の用途に使った場合など)
        logger.info("対応する支払いのない Checkout のイベントを無視しました (%s)", session["id"])
        return
    if event.get("account") != payment.stripe_account_id:
        logger.warning("連結アカウントが一致しない Checkout のイベントを無視しました (%s)", event["id"])
        return
    state = stripe_client.CheckoutSessionState(
        session_id=session["id"],
        status=session.get("status") or "",
        payment_status=session.get("payment_status") or "",
        payment_intent_id=session.get("payment_intent"),
        url=None,
    )
    apply_checkout_state(db, payment, state)


def handle_stripe_event(db: Session, event: dict[str, Any]) -> None:
    """署名を確かめた Webhook のイベントを反映する(commit は呼び出し側)。

    Stripe は同じイベントを再送することがあるので、処理したイベントの ID を記録して二度は反映しない。
    同時に同じイベントが届いた場合は、commit 時の主キーの重複(IntegrityError)を呼び出し側で処理済みとして扱う。
    反映に Stripe の呼び出しが要り、それが失敗したら StripeUnavailable をそのまま投げる(Stripe が再送する)
    """
    if db.get(StripeEvent, event["id"]) is not None:
        return
    db.add(StripeEvent(event_id=event["id"], type=event["type"]))

    if event["type"] in _CHECKOUT_EVENTS:
        _apply_checkout_event(db, event)
    elif event["type"] in ("charge.refund.updated", "refund.failed"):
        refund = event["data"]["object"]
        # 依頼した返金が、後から Stripe 側で失敗した(カードが使えなくなったなど)
        if refund.get("status") == "failed" and refund.get("payment_intent"):
            mark_refund_failed(db, refund["payment_intent"], event.get("account"))
    elif event["type"] == "account.updated":
        account = event["data"]["object"]
        apply_account_state(
            db,
            stripe_client.AccountState(
                account_id=account["id"],
                charges_enabled=bool(account.get("charges_enabled")),
                details_submitted=bool(account.get("details_submitted")),
            ),
        )
