"""Stripe API の呼び出し口。

アプリから Stripe を呼ぶのはこのモジュールの関数だけにする。テストではここの関数を monkeypatch で差し替える。
Stripe の例外は StripeUnavailable に変えて投げ、呼び出し側が SDK の例外の種類を知らなくて済むようにする。
"""

import json
import logging
from dataclasses import dataclass

import stripe

from app.config import settings

logger = logging.getLogger(__name__)


class StripeUnavailable(Exception):
    """Stripe の呼び出しに失敗した(未設定・通信エラー・Stripe が拒否した)"""


def _client() -> stripe.StripeClient:
    if not settings.online_payment_enabled:
        raise StripeUnavailable("STRIPE_SECRET_KEY が未設定です")
    return stripe.StripeClient(settings.stripe_secret_key)


# ---- Checkout(参加者の支払い) ----
# 参加費は運営の Stripe アカウントで受け取る。主催者の受取分は運営がアプリの記録をもとに振り込む


@dataclass(frozen=True)
class CheckoutLineItem:
    name: str
    unit_amount: int
    quantity: int


@dataclass(frozen=True)
class CheckoutSessionState:
    """Checkout Session の状態のうち、アプリが使うもの"""

    session_id: str
    # open(支払い待ち) / complete(完了) / expired(期限切れ)
    status: str
    # paid / unpaid / no_payment_required
    payment_status: str
    payment_intent_id: str | None
    # 支払い画面の URL。status が open の間だけ入っている
    url: str | None


def _session_state(session: stripe.checkout.Session) -> CheckoutSessionState:
    payment_intent = session.payment_intent
    return CheckoutSessionState(
        session_id=session.id,
        status=session.status or "",
        payment_status=session.payment_status or "",
        payment_intent_id=payment_intent if isinstance(payment_intent, str) or payment_intent is None else payment_intent.id,
        url=session.url,
    )


def create_checkout_session(
    *,
    idempotency_key: str,
    item: CheckoutLineItem,
    currency: str,
    customer_email: str,
    expires_at: int,
    success_url: str,
    cancel_url: str,
    metadata: dict[str, str],
) -> CheckoutSessionState:
    """参加費の支払い画面(Checkout Session)を作る。

    expires_at は UNIX 時刻(秒)。Stripe は作成から 30 分以上先しか受け付けない
    """
    try:
        session = _client().v1.checkout.sessions.create(
            {
                "mode": "payment",
                "payment_method_types": ["card"],
                "line_items": [
                    {
                        "quantity": item.quantity,
                        "price_data": {
                            "currency": currency,
                            "unit_amount": item.unit_amount,
                            "product_data": {"name": item.name},
                        },
                    }
                ],
                "payment_intent_data": {"metadata": metadata},
                "customer_email": customer_email,
                "expires_at": expires_at,
                "success_url": success_url,
                "cancel_url": cancel_url,
                "metadata": metadata,
                "locale": "ja",
            },
            {"idempotency_key": idempotency_key},
        )
    except stripe.StripeError as exc:
        logger.exception("Stripe の支払い画面を作成できませんでした (%s)", idempotency_key)
        raise StripeUnavailable(str(exc)) from exc
    return _session_state(session)


def retrieve_checkout_session(session_id: str) -> CheckoutSessionState:
    try:
        session = _client().v1.checkout.sessions.retrieve(session_id)
    except stripe.StripeError as exc:
        logger.exception("Stripe の支払い画面を取得できませんでした (%s)", session_id)
        raise StripeUnavailable(str(exc)) from exc
    return _session_state(session)


def expire_checkout_session(session_id: str) -> CheckoutSessionState:
    """支払い画面を閉じて、それ以上支払えないようにする。支払い済み・期限切れのものは Stripe がエラーを返す"""
    try:
        session = _client().v1.checkout.sessions.expire(session_id)
    except stripe.StripeError as exc:
        logger.warning("Stripe の支払い画面を閉じられませんでした (%s): %s", session_id, exc)
        raise StripeUnavailable(str(exc)) from exc
    return _session_state(session)


def retrieve_stripe_fee(payment_intent_id: str) -> int:
    """支払いにかかった Stripe の決済手数料(円)。

    参加者都合の取消で返金額から差し引くため、計算ではなく Stripe が実際に引いた額を使う
    """
    try:
        intent = _client().v1.payment_intents.retrieve(
            payment_intent_id,
            {"expand": ["latest_charge.balance_transaction"]},
        )
    except stripe.StripeError as exc:
        logger.exception("Stripe の決済手数料を取得できませんでした (%s)", payment_intent_id)
        raise StripeUnavailable(str(exc)) from exc
    charge = intent.latest_charge
    balance_transaction = getattr(charge, "balance_transaction", None)
    if balance_transaction is None or isinstance(balance_transaction, str):
        raise StripeUnavailable(f"決済の明細を取得できませんでした ({payment_intent_id})")
    return sum(detail.amount for detail in balance_transaction.fee_details if detail.type == "stripe_fee")


# ---- Webhook ----


def construct_event(payload: bytes, signature: str | None) -> dict:
    """Webhook の署名を確かめ、イベントを dict で返す。署名が合わなければ ValueError を投げる"""
    if not settings.stripe_webhook_secret:
        raise ValueError("STRIPE_WEBHOOK_SECRET が未設定です")
    if not signature:
        raise ValueError("署名がありません")
    try:
        stripe.WebhookSignature.verify_header(payload, signature, settings.stripe_webhook_secret, 300)
    except stripe.SignatureVerificationError as exc:
        raise ValueError("署名を確かめられませんでした") from exc
    return json.loads(payload)


# ---- 返金 ----


def create_refund(
    *,
    payment_intent_id: str,
    amount: int,
    idempotency_key: str,
    metadata: dict[str, str],
) -> str:
    """支払いを返金し、返金の ID を返す。Stripe の決済手数料は戻らない(運営の負担になる)"""
    try:
        refund = _client().v1.refunds.create(
            {
                "payment_intent": payment_intent_id,
                "amount": amount,
                "metadata": metadata,
            },
            {"idempotency_key": idempotency_key},
        )
    except stripe.StripeError as exc:
        logger.exception("Stripe で返金できませんでした (%s)", idempotency_key)
        raise StripeUnavailable(str(exc)) from exc
    return refund.id


def find_active_refund(*, payment_intent_id: str, payment_id: int) -> str | None:
    """この支払いのために作った返金のうち、失敗・取り消しになっていないものの ID。なければ None。

    返金の依頼の応答を受け取れなかった場合に、二重に返金しないよう再試行の前に確かめる
    """
    try:
        refunds = _client().v1.refunds.list({"payment_intent": payment_intent_id, "limit": 100})
    except stripe.StripeError as exc:
        logger.exception("Stripe の返金を確認できませんでした (%s)", payment_intent_id)
        raise StripeUnavailable(str(exc)) from exc
    for refund in refunds.data:
        metadata = refund.metadata or {}
        if metadata.get("payment_id") == str(payment_id) and refund.status not in ("failed", "canceled"):
            return refund.id
    return None
