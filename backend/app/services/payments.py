"""参加費のオンライン決済(Stripe Checkout)。

参加費は運営の Stripe アカウントで受け取り、運営の手数料を除いた額を主催者の受取額として支払いごとに記録する。
Stripe の決済手数料は運営の手数料から運営が払う。主催者への振込は services/payouts.py。

ほかの service から呼ばれる側なので、依存するのは models・notifications・core だけにする(循環 import を避ける)。
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.core import stripe_client
from app.core.errors import conflict, service_unavailable
from app.core.timeutil import utcnow_naive
from app.models.payment import PAYMENT_CURRENCY, Payment, PaymentStatus
from app.models.reservation import CancelReason, Reservation, ReservationStatus
from app.models.workshop import Workshop, WorkshopStatus
from app.services.notifications import add_payment_refund_failed_notice, add_payment_refunded_notice

logger = logging.getLogger(__name__)

def can_accept_online_payment() -> bool:
    """いまオンライン決済を受け付けられるか(運営側の設定)"""
    return settings.online_payment_enabled


def ensure_can_accept_online_payment() -> None:
    """予約の受付時に確かめる。公開後に運営側の設定が外れた場合もここで断る"""
    if not can_accept_online_payment():
        raise conflict("このワークショップは現在オンライン決済を受け付けていません。主催者にお問い合わせください")


# ---- 参加者の支払い(Checkout) ----

# 支払い待ちの席を確保しておく時間。Stripe の Checkout は作成から 30 分以上先の期限しか受け付けないので、
# 予約を記録してから Stripe を呼ぶまでの時間を見込んで少し長くする
PAYMENT_HOLD = timedelta(minutes=32)

CHECKOUT_UNAVAILABLE = "お支払いの準備ができませんでした。時間をおいてもう一度お試しください"


def platform_fee_for(amount: int) -> int:
    """運営の手数料。1 円未満は切り捨てる(主催者に不利にならないように)"""
    return amount * settings.platform_fee_percent // 100


def latest_payment(reservation: Reservation) -> Payment | None:
    """予約の最新の支払い試行。予約し直すたびに増えるので、最後のものが今の支払いになる"""
    return reservation.payments[-1] if reservation.payments else None


def add_payment(db: Session, reservation: Reservation, workshop: Workshop) -> Payment:
    """予約の支払いを1回分記録する(commit は呼び出し側)。

    金額は予約時の参加費 × 枚数で、運営の手数料と主催者の受取額もここで確定する
    (後で手数料率を変えても、予約済みの分の受取額は変わらない)
    """
    amount = workshop.price * reservation.ticket_count
    platform_fee = platform_fee_for(amount)
    payment = Payment(
        reservation=reservation,
        amount=amount,
        platform_fee_amount=platform_fee,
        facilitator_amount=amount - platform_fee,
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
            # 同じ支払いで二重に作らない(再試行しても同じ画面が返る)
            idempotency_key=f"checkout-payment-{payment.id}",
            item=stripe_client.CheckoutLineItem(
                name=workshop.title, unit_amount=workshop.price, quantity=reservation.ticket_count
            ),
            currency=payment.currency,
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
            stripe_client.expire_checkout_session(state.session_id)
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

    主催者都合は全額。参加者都合は、Stripe の決済手数料と運営の手数料を差し引く。
    どちらの場合も主催者の受取はなくなる(返金になった支払いは主催者の残高に数えない)。
    フロントエンドの utils/payment.ts の refundAmountFor と揃える
    """
    if reason == CancelReason.facilitator:
        return payment.amount
    return max(0, payment.amount - (payment.stripe_fee_amount or 0) - payment.platform_fee_amount)


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
                payment_intent_id=payment.stripe_payment_intent_id,
                payment_id=payment.id,
            )
        if refund_id is None:
            refund_id = stripe_client.create_refund(
                payment_intent_id=payment.stripe_payment_intent_id,
                amount=amount,
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


def mark_refund_failed(db: Session, payment_intent_id: str) -> None:
    """依頼した返金が Stripe 側で失敗した(カードが使えなくなったなど)ことを記録する(commit は呼び出し側)。

    返金済みと知らせていた参加者には、完了できなかったことを知らせる
    """
    payment = db.scalar(
        select(Payment).where(Payment.stripe_payment_intent_id == payment_intent_id).with_for_update()
    )
    if payment is None:
        return
    if payment.status not in (PaymentStatus.refund_pending, PaymentStatus.refunded):
        # Stripe のダッシュボードから行った返金など、アプリで依頼していない返金の失敗。
        # 支払いを refund_failed にすると主催者の売上から外れてしまうので、状態は変えずに運営へ知らせる
        logger.error("アプリで依頼していない返金が失敗しました。運営が確認してください (payment_id=%s)", payment.id)
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
            stripe_client.expire_checkout_session(payment.stripe_checkout_session_id)
        except stripe_client.StripeUnavailable:
            continue
        payment.status = PaymentStatus.expired
        db.commit()


def find_payment_by_session(db: Session, session_id: str) -> Payment | None:
    return db.scalar(select(Payment).where(Payment.stripe_checkout_session_id == session_id))
