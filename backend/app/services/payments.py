"""参加費のオンライン決済(Stripe Connect の direct charge)。

参加費は主催者の連結アカウントで決済し、Stripe の決済手数料は主催者の残高から引かれる。
運営の手数料は application fee として別に受け取る。

ほかの service から呼ばれる側なので、依存するのは models・notifications・core だけにする(循環 import を避ける)。
"""

import logging
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.core import stripe_client
from app.core.errors import ONLINE_PAYMENT_DISABLED, conflict, service_unavailable
from app.core.timeutil import utcnow_naive
from app.models.payment import PAYMENT_CURRENCY, Payment, PaymentStatus
from app.models.reservation import Reservation, ReservationStatus
from app.models.user import User
from app.models.workshop import Workshop
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


def can_accept_online_payment(facilitator: User) -> bool:
    """主催者がいまオンライン決済を受け付けられるか(運営側の設定と、主催者の受け取り設定の両方)"""
    return settings.online_payment_enabled and payout_account_status(facilitator) == PayoutAccountStatus.enabled


def ensure_can_accept_online_payment(facilitator: User) -> None:
    """予約の受付時に確かめる。公開後に Stripe 側で止められた場合もここで断る"""
    if not can_accept_online_payment(facilitator):
        raise conflict("このワークショップは現在オンライン決済を受け付けていません。主催者にお問い合わせください")


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


# ---- 参加者の支払い(Checkout) ----

# 支払い待ちの席を確保しておく時間。Stripe の Checkout は作成から 30 分以上先の期限しか受け付けないので、
# 予約を記録してから Stripe を呼ぶまでの時間を見込んで少し長くする
PAYMENT_HOLD = timedelta(minutes=32)

CHECKOUT_UNAVAILABLE = "お支払いの準備ができませんでした。時間をおいてもう一度お試しください"


def application_fee_for(amount: int) -> int:
    """運営の手数料。1 円未満は切り捨てる(参加者・主催者に不利にならないように)"""
    return amount * settings.platform_fee_percent // 100


def latest_payment(reservation: Reservation) -> Payment | None:
    """予約の最新の支払い試行。予約し直すたびに増えるので、最後のものが今の支払いになる"""
    return reservation.payments[-1] if reservation.payments else None


def add_payment(db: Session, reservation: Reservation, workshop: Workshop, facilitator: User) -> Payment:
    """予約の支払いを1回分記録する(commit は呼び出し側)。金額は予約時の参加費 × 枚数で確定する"""
    if facilitator.stripe_account_id is None:
        raise conflict("このワークショップは現在オンライン決済を受け付けていません")
    amount = workshop.price * reservation.ticket_count
    payment = Payment(
        reservation=reservation,
        stripe_account_id=facilitator.stripe_account_id,
        amount=amount,
        application_fee_amount=application_fee_for(amount),
        currency=PAYMENT_CURRENCY,
    )
    db.add(payment)
    return payment


def _epoch_seconds(naive_utc: datetime) -> int:
    return int(naive_utc.replace(tzinfo=timezone.utc).timestamp())


def start_checkout(db: Session, reservation: Reservation, payment: Payment) -> str:
    """Stripe に支払い画面を作り、その URL を返す。

    例外として service の中で commit する: 予約(席の確保)を先に確定してロックを外してから Stripe を呼び、
    結果(Checkout Session の ID)をもう一度確定する。外部 API を待つ間ワークショップの行をロックし続けないため。
    Stripe が失敗したら、確保した席をすぐ手放して 503 を返す
    """
    workshop = reservation.workshop
    base = settings.frontend_base_url
    try:
        state = stripe_client.create_checkout_session(
            account_id=payment.stripe_account_id,
            # 同じ支払いで二重に作らない(再試行しても同じ画面が返る)
            idempotency_key=f"checkout-payment-{payment.id}",
            item=stripe_client.CheckoutLineItem(
                name=workshop.title, unit_amount=workshop.price, quantity=reservation.ticket_count
            ),
            currency=payment.currency,
            application_fee_amount=payment.application_fee_amount,
            customer_email=reservation.contact,
            expires_at=_epoch_seconds(reservation.payment_expires_at),
            success_url=f"{base}/reservations/{reservation.id}/payment/complete",
            cancel_url=f"{base}/workshops/{workshop.id}/reserve?payment=canceled",
            metadata={"reservation_id": str(reservation.id), "payment_id": str(payment.id)},
        )
    except stripe_client.StripeUnavailable as exc:
        _release_hold(db, reservation, payment)
        raise service_unavailable(CHECKOUT_UNAVAILABLE) from exc
    payment.stripe_checkout_session_id = state.session_id
    if state.url is None:
        # 支払える画面がないまま席を確保し続けないよう、失敗と同じく手放す
        _release_hold(db, reservation, payment)
        raise service_unavailable(CHECKOUT_UNAVAILABLE)
    db.commit()
    return state.url


def _release_hold(db: Session, reservation: Reservation, payment: Payment) -> None:
    payment.status = PaymentStatus.expired
    reservation.status = ReservationStatus.expired
    db.commit()


def record_paid(payment: Payment, *, payment_intent_id: str | None, stripe_fee: int) -> None:
    """支払いが済んだことを記録する(commit は呼び出し側)"""
    payment.status = PaymentStatus.paid
    payment.stripe_payment_intent_id = payment_intent_id
    payment.stripe_fee_amount = stripe_fee
    payment.paid_at = utcnow_naive()


def request_full_refund(payment: Payment) -> None:
    """支払われたが参加を確定できない(期限切れ後の支払い・満席・中止など)支払いを、全額返金の対象にする。

    返金は参加者に落ち度のない取り消しなので全額にする。Stripe への依頼は定期処理が行う(commit は呼び出し側)
    """
    payment.status = PaymentStatus.refund_pending
    payment.refund_amount = payment.amount
    logger.warning("参加を確定できない支払いを全額返金の対象にしました (payment_id=%s)", payment.id)


def find_payment_by_session(db: Session, session_id: str) -> Payment | None:
    return db.scalar(select(Payment).where(Payment.stripe_checkout_session_id == session_id))
