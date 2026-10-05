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

# 連結アカウント(主催者)の国。日本の主催者だけを対象にする
CONNECT_ACCOUNT_COUNTRY = "JP"


class StripeUnavailable(Exception):
    """Stripe の呼び出しに失敗した(未設定・通信エラー・Stripe が拒否した)"""


@dataclass(frozen=True)
class AccountState:
    """連結アカウントの状態のうち、アプリが使うもの"""

    account_id: str
    charges_enabled: bool
    details_submitted: bool


def _client() -> stripe.StripeClient:
    if not settings.online_payment_enabled:
        raise StripeUnavailable("STRIPE_SECRET_KEY が未設定です")
    return stripe.StripeClient(settings.stripe_secret_key)


def _account_state(account: stripe.Account) -> AccountState:
    return AccountState(
        account_id=account.id,
        charges_enabled=bool(account.charges_enabled),
        details_submitted=bool(account.details_submitted),
    )


def create_express_account(*, user_id: int, email: str) -> AccountState:
    """主催者の Express アカウントを作る。

    ボタンの二度押しなどで同じ主催者に2つ作らないよう、冪等キーをユーザーごとに固定する
    """
    try:
        account = _client().v1.accounts.create(
            {
                "type": "express",
                "country": CONNECT_ACCOUNT_COUNTRY,
                "email": email,
                "capabilities": {"card_payments": {"requested": True}, "transfers": {"requested": True}},
                "metadata": {"user_id": str(user_id)},
            },
            {"idempotency_key": f"express-account-user-{user_id}"},
        )
    except stripe.StripeError as exc:
        logger.exception("Stripe の連結アカウントを作成できませんでした (user_id=%s)", user_id)
        raise StripeUnavailable(str(exc)) from exc
    return _account_state(account)


def retrieve_account(account_id: str) -> AccountState:
    try:
        account = _client().v1.accounts.retrieve(account_id)
    except stripe.StripeError as exc:
        logger.exception("Stripe の連結アカウントを取得できませんでした (%s)", account_id)
        raise StripeUnavailable(str(exc)) from exc
    return _account_state(account)


def create_account_link(account_id: str, *, refresh_url: str, return_url: str) -> str:
    """受け取り設定(本人確認・口座登録)の画面の URL を返す。URL は一度しか使えず、短時間で切れる"""
    try:
        link = _client().v1.account_links.create(
            {
                "account": account_id,
                "refresh_url": refresh_url,
                "return_url": return_url,
                "type": "account_onboarding",
            }
        )
    except stripe.StripeError as exc:
        logger.exception("Stripe の受け取り設定の URL を作成できませんでした (%s)", account_id)
        raise StripeUnavailable(str(exc)) from exc
    return link.url


def create_login_link(account_id: str) -> str:
    """Express ダッシュボード(売上・入金の確認)にログインする URL を返す"""
    try:
        link = _client().v1.accounts.login_links.create(account_id)
    except stripe.StripeError as exc:
        logger.exception("Stripe のダッシュボードの URL を作成できませんでした (%s)", account_id)
        raise StripeUnavailable(str(exc)) from exc
    return link.url


# ---- Checkout(参加者の支払い) ----
# 主催者の連結アカウント上で作る(direct charge)。どの呼び出しにも stripe_account を付ける


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
    account_id: str,
    idempotency_key: str,
    item: CheckoutLineItem,
    currency: str,
    application_fee_amount: int,
    customer_email: str,
    expires_at: int,
    success_url: str,
    cancel_url: str,
    metadata: dict[str, str],
) -> CheckoutSessionState:
    """参加費の支払い画面(Checkout Session)を主催者の連結アカウント上に作る。

    expires_at は UNIX 時刻(秒)。Stripe は作成から 30 分以上先しか受け付けない
    """
    payment_intent_data: dict = {"metadata": metadata}
    # 運営の手数料が 0 円なら application fee を付けない(Stripe は 0 を受け付けないことがあるため)
    if application_fee_amount > 0:
        payment_intent_data["application_fee_amount"] = application_fee_amount
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
                "payment_intent_data": payment_intent_data,
                "customer_email": customer_email,
                "expires_at": expires_at,
                "success_url": success_url,
                "cancel_url": cancel_url,
                "metadata": metadata,
                "locale": "ja",
            },
            {"stripe_account": account_id, "idempotency_key": idempotency_key},
        )
    except stripe.StripeError as exc:
        logger.exception("Stripe の支払い画面を作成できませんでした (%s)", idempotency_key)
        raise StripeUnavailable(str(exc)) from exc
    return _session_state(session)


def retrieve_checkout_session(session_id: str, *, account_id: str) -> CheckoutSessionState:
    try:
        session = _client().v1.checkout.sessions.retrieve(session_id, options={"stripe_account": account_id})
    except stripe.StripeError as exc:
        logger.exception("Stripe の支払い画面を取得できませんでした (%s)", session_id)
        raise StripeUnavailable(str(exc)) from exc
    return _session_state(session)


def expire_checkout_session(session_id: str, *, account_id: str) -> CheckoutSessionState:
    """支払い画面を閉じて、それ以上支払えないようにする。支払い済み・期限切れのものは Stripe がエラーを返す"""
    try:
        session = _client().v1.checkout.sessions.expire(session_id, options={"stripe_account": account_id})
    except stripe.StripeError as exc:
        logger.warning("Stripe の支払い画面を閉じられませんでした (%s): %s", session_id, exc)
        raise StripeUnavailable(str(exc)) from exc
    return _session_state(session)


def retrieve_stripe_fee(payment_intent_id: str, *, account_id: str) -> int:
    """支払いにかかった Stripe の決済手数料(円)。運営の手数料(application fee)は含めない。

    参加者都合の取消で返金額から差し引くため、計算ではなく Stripe が実際に引いた額を使う
    """
    try:
        intent = _client().v1.payment_intents.retrieve(
            payment_intent_id,
            {"expand": ["latest_charge.balance_transaction"]},
            {"stripe_account": account_id},
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
