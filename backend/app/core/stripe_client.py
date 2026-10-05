"""Stripe API の呼び出し口。

アプリから Stripe を呼ぶのはこのモジュールの関数だけにする。テストではここの関数を monkeypatch で差し替える。
Stripe の例外は StripeUnavailable に変えて投げ、呼び出し側が SDK の例外の種類を知らなくて済むようにする。
"""

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
