"""参加費のオンライン決済(Stripe Connect の direct charge)。

参加費は主催者の連結アカウントで決済し、Stripe の決済手数料は主催者の残高から引かれる。
運営の手数料は application fee として別に受け取る。

ほかの service から呼ばれる側なので、依存するのは models・notifications・core だけにする(循環 import を避ける)。
"""

import logging
from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.core import stripe_client
from app.core.errors import ONLINE_PAYMENT_DISABLED, conflict, service_unavailable
from app.models.user import User
from app.schemas.payment import PayoutAccountRead, PayoutAccountStatus

logger = logging.getLogger(__name__)

# Stripe の受け取り設定の画面から戻ってくる、フロントエンドの画面のパス。
# フロントエンドの utils/payment.ts の PAYOUT_SETTINGS_PATH・PAYOUT_LINK_EXPIRED_PARAM と揃える
PAYOUT_SETTINGS_PATH = "/manage/payout"


@contextmanager
def _stripe_call() -> Iterator[None]:
    """Stripe の呼び出しの失敗を 503 に変える。原因は stripe_client がログに残している"""
    try:
        yield
    except stripe_client.StripeUnavailable as exc:
        raise service_unavailable() from exc


def _ensure_online_payment_enabled() -> None:
    if not settings.online_payment_enabled:
        raise conflict(ONLINE_PAYMENT_DISABLED)


def payout_account_status(user: User) -> PayoutAccountStatus:
    if user.stripe_account_id is None:
        return PayoutAccountStatus.not_registered
    if user.stripe_charges_enabled:
        return PayoutAccountStatus.enabled
    return PayoutAccountStatus.pending


def to_payout_account_read(user: User) -> PayoutAccountRead:
    return PayoutAccountRead(
        status=payout_account_status(user),
        online_payment_available=settings.online_payment_enabled,
    )


def sync_payout_account(db: Session, user: User) -> None:
    """設定の途中・審査中の連結アカウントの状態を Stripe から読み直す(commit は呼び出し側)。

    受け取り設定の画面から戻ってきた直後は Webhook(account.updated)より先に画面が開かれるので、
    表示のたびに確かめる。受け付けられるようになった後は Webhook で同期するので読み直さない。
    読み直しは補助なので、Stripe に繋がらなくても保存済みの状態のまま表示できるようにする
    """
    if user.stripe_account_id is None or user.stripe_charges_enabled or not settings.online_payment_enabled:
        return
    try:
        state = stripe_client.retrieve_account(user.stripe_account_id)
    except stripe_client.StripeUnavailable:
        return
    user.stripe_charges_enabled = state.charges_enabled


def start_payout_onboarding(db: Session, user: User) -> str:
    """受け取り設定の画面の URL を返す。連結アカウントがなければ作る。

    例外として service の中で commit する: Stripe にアカウントを作ったら、画面の URL を作る前に ID を確定させる。
    URL の作成に失敗しても ID が残っていれば、再試行で同じアカウントの続きから設定でき、
    冪等キーの期限(24 時間)が過ぎた後に2つ目のアカウントを作ってしまうこともない。
    同じ主催者の同時の操作で2つ作らないよう、ユーザーの行をロックしてから確かめる
    """
    _ensure_online_payment_enabled()
    with _stripe_call():
        if user.stripe_account_id is None:
            db.refresh(user, with_for_update=True)
            if user.stripe_account_id is None:
                state = stripe_client.create_express_account(user_id=user.id, email=user.email)
                user.stripe_account_id = state.account_id
                user.stripe_charges_enabled = state.charges_enabled
            db.commit()
        base = f"{settings.frontend_base_url}{PAYOUT_SETTINGS_PATH}"
        # refresh_url は URL の期限が切れたとき、return_url は Stripe の画面を抜けたときの戻り先。
        # 戻ったあとの状態は画面が API で読み直すので、returned=1 は戻り方の区別のためだけに付ける
        return stripe_client.create_account_link(
            user.stripe_account_id, refresh_url=f"{base}?refresh=1", return_url=f"{base}?returned=1"
        )


def payout_dashboard_url(user: User) -> str:
    """売上・入金を確認する Stripe のダッシュボードの URL を返す"""
    _ensure_online_payment_enabled()
    if payout_account_status(user) != PayoutAccountStatus.enabled:
        raise conflict("受け取り設定が完了すると、売上を確認できます")
    with _stripe_call():
        return stripe_client.create_login_link(user.stripe_account_id)


def apply_account_state(db: Session, state: stripe_client.AccountState) -> None:
    """Webhook(account.updated)で届いた連結アカウントの状態を主催者に反映する(commit は呼び出し側)"""
    user = db.scalar(select(User).where(User.stripe_account_id == state.account_id))
    if user is not None:
        user.stripe_charges_enabled = state.charges_enabled
