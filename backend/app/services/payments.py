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
from app.models.reservation import CancelReason, Reservation, ReservationStatus
from app.models.user import User
from app.models.workshop import Workshop, WorkshopStatus
from app.schemas.payment import PayoutAccountRead, PayoutAccountStatus
from app.services.notifications import add_payment_refund_failed_notice, add_payment_refunded_notice

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
    # Stripe を待つ間に、ワークショップが中止された・参加者が取りやめた場合は、作った画面を閉じて支払わせない
    db.refresh(reservation)
    db.refresh(workshop)
    if reservation.status != ReservationStatus.pending_payment or workshop.status != WorkshopStatus.published:
        try:
            stripe_client.expire_checkout_session(state.session_id, account_id=payment.stripe_account_id)
            payment.status = PaymentStatus.expired
            db.commit()
        except stripe_client.StripeUnavailable:
            # 閉じられなくても、支払われたら確定できないので全額返金の対象になる
            pass
        raise conflict("このワークショップは現在予約を受け付けていません")
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


def refund_amount_for(payment: Payment, reason: CancelReason) -> int:
    """取消の理由ごとの返金額。返金額の定義はここだけに置く。

    主催者都合は全額。参加者都合は、Stripe の決済手数料と運営の手数料を差し引く(主催者の収支が 0 になる)。
    フロントエンドの utils/payment.ts の refundAmountFor と揃える
    """
    if reason == CancelReason.facilitator:
        return payment.amount
    return max(0, payment.amount - (payment.stripe_fee_amount or 0) - payment.application_fee_amount)


def request_refund(payment: Payment, reason: CancelReason) -> int:
    """支払い済みの参加費を返金の対象にし、返金額を返す(commit は呼び出し側)。

    Stripe への依頼は commit の後に process_refund で行う(失敗したら定期処理が再試行する)
    """
    payment.status = PaymentStatus.refund_pending
    payment.refund_amount = refund_amount_for(payment, reason)
    return payment.refund_amount


def request_full_refund(payment: Payment) -> None:
    """支払われたが参加を確定できない(期限切れ後の支払い・満席・中止など)支払いを、全額返金の対象にする。

    参加者に落ち度のない取り消しなので全額にする(commit は呼び出し側)
    """
    request_refund(payment, CancelReason.facilitator)
    logger.warning("参加を確定できない支払いを全額返金の対象にしました (payment_id=%s)", payment.id)


def paid_payment(reservation: Reservation) -> Payment | None:
    """予約の今の支払いが支払い済みなら、その支払い"""
    payment = latest_payment(reservation)
    return payment if payment is not None and payment.status == PaymentStatus.paid else None


# ---- 返金の依頼 ----

# 返金の依頼に続けて失敗したら、自動の再試行をやめて運営の対応に回す回数
MAX_REFUND_ATTEMPTS = 5


def _mark_refunded(db: Session, payment: Payment) -> None:
    payment.status = PaymentStatus.refunded
    payment.refunded_at = utcnow_naive()
    if payment.refund_amount:
        add_payment_refunded_notice(db, payment.reservation, payment.refund_amount)


def process_refund(db: Session, payment_id: int) -> None:
    """返金の対象になった支払い1件を Stripe で返金する。

    例外として service の中で commit する: 取消・中止を確定した後や定期処理から、1件ずつ結果を確定させるため
    (途中で失敗しても、済んだ返金の記録は残る)。二重に依頼しないよう支払いの行をロックする。
    このロックは Stripe の応答まで持つ(外部 API を待つ間ロックを持たない方針の例外)。支払い1行だけで、
    返金待ちの支払いを他の処理が変えることはほぼないため。
    失敗したら回数を数えて残し、定期処理が再試行する。Stripe は同じ冪等キーに前回と同じ応答(失敗も含む)を
    返すので、再試行では先に Stripe 上の返金を確かめ、なければ試行回数を含めた新しいキーで依頼する
    """
    if not settings.online_payment_enabled:
        # 運営側の設定が外れている間は依頼しない(失敗として数えると、設定を戻す前に返金失敗になってしまう)
        return
    payment = db.get(Payment, payment_id, with_for_update=True, populate_existing=True)
    if payment is None or payment.status != PaymentStatus.refund_pending:
        db.rollback()
        return
    amount = payment.refund_amount or 0
    if amount <= 0:
        # 参加者都合で手数料を差し引くと返金額が残らない場合。Stripe には依頼しない
        _mark_refunded(db, payment)
        db.commit()
        return
    try:
        if payment.stripe_payment_intent_id is None:
            raise stripe_client.StripeUnavailable("PaymentIntent が記録されていません")
        refund_id = None
        if payment.refund_attempts > 0:
            # 前回の依頼が Stripe に届いていたのに応答を受け取れなかった場合に、二重に返金しない
            refund_id = stripe_client.find_active_refund(
                account_id=payment.stripe_account_id,
                payment_intent_id=payment.stripe_payment_intent_id,
                payment_id=payment.id,
            )
        if refund_id is None:
            refund_id = stripe_client.create_refund(
                account_id=payment.stripe_account_id,
                payment_intent_id=payment.stripe_payment_intent_id,
                amount=amount,
                # 全額返金なら運営の手数料も主催者へ戻す。差し引いて返すとき(参加者都合)は戻さない
                refund_application_fee=amount == payment.amount,
                idempotency_key=f"refund-payment-{payment.id}-{payment.refund_attempts}",
                metadata={"payment_id": str(payment.id)},
            )
    except stripe_client.StripeUnavailable:
        payment.refund_attempts += 1
        if payment.refund_attempts >= MAX_REFUND_ATTEMPTS:
            payment.status = PaymentStatus.refund_failed
            logger.error("返金を自動で行えませんでした。運営が対応してください (payment_id=%s)", payment.id)
        db.commit()
        return
    payment.stripe_refund_id = refund_id
    _mark_refunded(db, payment)
    db.commit()


def process_pending_refunds(db: Session, payment_ids: list[int] | None = None) -> None:
    """返金の対象になっている支払いを返金する。payment_ids を省くと、返金待ちのものすべて(定期処理)。

    取消・中止を確定した後に呼ぶので、1件の予期しない失敗で残りの返金や呼び出し側の処理を止めない
    (失敗したものは返金待ちのまま残り、定期処理が拾う)
    """
    if payment_ids is None:
        payment_ids = list(db.scalars(select(Payment.id).where(Payment.status == PaymentStatus.refund_pending)))
    for payment_id in payment_ids:
        try:
            process_refund(db, payment_id)
        except Exception:
            db.rollback()
            logger.exception("返金の処理に失敗しました (payment_id=%s)", payment_id)


def mark_refund_failed(db: Session, payment_intent_id: str, account_id: str | None) -> None:
    """依頼した返金が Stripe 側で失敗した(カードが使えなくなったなど)ことを記録する(commit は呼び出し側)。

    返金済みと知らせていた参加者には、完了できなかったことを知らせる
    """
    payment = db.scalar(
        select(Payment).where(Payment.stripe_payment_intent_id == payment_intent_id).with_for_update()
    )
    if payment is None or payment.stripe_account_id != account_id:
        return
    if payment.status == PaymentStatus.refunded:
        add_payment_refund_failed_notice(db, payment.reservation)
    payment.status = PaymentStatus.refund_failed
    logger.error("Stripe で返金が失敗しました。運営が対応してください (payment_id=%s)", payment.id)


def expire_open_checkouts(db: Session, payments: list[Payment]) -> None:
    """支払い待ちの支払い画面を Stripe で閉じる(ワークショップの中止の後に呼ぶ)。

    例外として service の中で commit する: 1件ずつ結果を確定させるため。閉じられなかったもの(その間に支払いが
    済んだなど)は Webhook で反映され、中止済みなので全額返金の対象になる
    """
    for payment in payments:
        if payment.status != PaymentStatus.pending or payment.stripe_checkout_session_id is None:
            continue
        try:
            stripe_client.expire_checkout_session(
                payment.stripe_checkout_session_id, account_id=payment.stripe_account_id
            )
        except stripe_client.StripeUnavailable:
            continue
        payment.status = PaymentStatus.expired
        db.commit()


def find_payment_by_session(db: Session, session_id: str) -> Payment | None:
    return db.scalar(select(Payment).where(Payment.stripe_checkout_session_id == session_id))
