import logging
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app.core import stripe_client
from app.core.errors import RESERVATION_NOT_FOUND, WORKSHOP_NOT_FOUND, conflict, not_found, service_unavailable
from app.core.timeutil import hours_label, utcnow_naive
from app.models.payment import Payment, PaymentStatus
from app.models.reservation import AttendanceStatus, CancelReason, Reservation, ReservationStatus
from app.models.user import User
from app.models.workshop import PaymentMethod, Workshop, WorkshopStatus
from app.schemas.reservation import PaymentSummary, ReservationCreate, ReservationRead
from app.services.job_lock import named_lock
from app.services.notifications import add_reservation_canceled_notice
from app.services.payments import (
    PAYMENT_HOLD,
    add_payment,
    ensure_can_accept_online_payment,
    latest_payment,
    paid_payment,
    process_pending_refunds,
    record_paid,
    request_full_refund,
    request_refund,
)
from app.services.workshops import (
    RESERVATION_DEADLINE_BEFORE,
    can_manage,
    is_holding_seat,
    lock_workshop,
    reservation_deadline,
    reserved_count,
    to_workshop_reads,
)

logger = logging.getLogger(__name__)

# 出欠は開始日時のこの時間前から記録できる(受付の準備や、前日に欠席の連絡を受けた場合のため)。
# フロントエンドの utils/workshop.ts の ATTENDANCE_OPEN_HOURS_BEFORE と揃える
ATTENDANCE_OPEN_BEFORE = timedelta(hours=24)

# to_reservation_reads は予約者名・ワークショップ・主催者名・支払いを参照するので、一覧はこれを付けて読み込む
RESERVATION_LOAD_OPTIONS = (
    selectinload(Reservation.user),
    selectinload(Reservation.workshop).selectinload(Workshop.facilitator),
    selectinload(Reservation.payments),
)


# 支払いが済んだと Stripe から知らされたときに、反映してよい支払いの状態。
# 期限切れ(expired)も含める: 期限ぎりぎりの支払いや、支払い画面を閉じる前に済んだ支払いがあるため
_PAYABLE_STATUSES = (PaymentStatus.pending, PaymentStatus.expired)


def _payment_summary(reservation: Reservation, show_fees: bool) -> PaymentSummary | None:
    """手数料の内訳は主催者が負担するものなので、主催者・運営にだけ見せる"""
    payment = latest_payment(reservation)
    if payment is None:
        return None
    return PaymentSummary(
        status=payment.status,
        amount=payment.amount,
        application_fee_amount=payment.application_fee_amount if show_fees else None,
        stripe_fee_amount=payment.stripe_fee_amount if show_fees else None,
        refund_amount=payment.refund_amount,
    )


def to_reservation_reads(
    db: Session, reservations: Sequence[Reservation], current_user: User | None = None
) -> list[ReservationRead]:
    """複数件をまとめて変換する。ワークショップ部分は同じものを1回だけ組み立てる。

    予約者名・ワークショップ・主催者名・支払いは関連を参照するので、呼び出し側で
    RESERVATION_LOAD_OPTIONS を付けて読み込んでおくと 1件ずつの読み込みを避けられる。
    """
    unique_workshops = list({r.workshop_id: r.workshop for r in reservations}.values())
    workshop_reads = {w.id: w for w in to_workshop_reads(db, unique_workshops, current_user)}
    return [
        ReservationRead(
            id=r.id,
            workshop_id=r.workshop_id,
            workshop=workshop_reads[r.workshop_id],
            user_id=r.user_id,
            user_name=r.user.name,
            attendee_name=r.attendee_name,
            contact=r.contact,
            ticket_count=r.ticket_count,
            status=r.status,
            attendance=r.attendance,
            cancel_reason=r.cancel_reason,
            payment_expires_at=r.payment_expires_at if r.status == ReservationStatus.pending_payment else None,
            payment=_payment_summary(r, show_fees=can_manage(current_user, r.workshop)),
            created_at=r.created_at,
        )
        for r in reservations
    ]


def to_reservation_read(db: Session, reservation: Reservation, current_user: User | None = None) -> ReservationRead:
    return to_reservation_reads(db, [reservation], current_user)[0]


def get_workshop_reservation(db: Session, workshop: Workshop, reservation_id: int) -> Reservation:
    """ワークショップの予約を1件取得する。別のワークショップの予約は存在しないのと同じく 404 にする"""
    reservation = db.get(Reservation, reservation_id)
    if reservation is None or reservation.workshop_id != workshop.id:
        raise not_found(RESERVATION_NOT_FOUND)
    return reservation


def get_my_reservation(db: Session, reservation_id: int, user: User) -> Reservation:
    """自分の予約を1件取得する。他人の予約は存在しないのと同じく 404 にする"""
    reservation = db.get(Reservation, reservation_id)
    if reservation is None or reservation.user_id != user.id:
        raise not_found(RESERVATION_NOT_FOUND)
    return reservation


def _is_current_pending(reservation: Reservation, payment: Payment) -> bool:
    """予約が支払い待ちで、payment がその予約の今の支払いか(予約し直す前の古い支払いではないか)"""
    return reservation.status == ReservationStatus.pending_payment and latest_payment(reservation) is payment


@dataclass
class ReservationStart:
    """予約の受付の結果。オンライン決済なら、どの支払いの画面へ案内するかを持つ"""

    reservation: Reservation
    # 新しく Stripe の支払い画面を作る支払い
    new_payment: Payment | None = None
    # 支払い待ちのまま戻ってきた人が再開する支払い
    resume_payment: Payment | None = None


def create_reservation(db: Session, workshop_id: int, user: User, payload: ReservationCreate) -> ReservationStart:
    """予約できるかを確かめてから予約を追加する(commit は呼び出し側)。

    同時に申し込まれても定員を超えないよう、ワークショップの行をロックしてから予約数を数える(commit まで保持)。
    オンライン決済のワークショップでは、支払い待ち(pending_payment)として PAYMENT_HOLD の間だけ席を確保し、
    支払いが済んだら確定する。支払い画面は commit の後に呼び出し側が start_checkout で作る
    """
    workshop = lock_workshop(db, workshop_id)
    if workshop is None or workshop.status != WorkshopStatus.published:
        raise not_found(WORKSHOP_NOT_FOUND)
    if utcnow_naive() >= reservation_deadline(workshop.start_at):
        raise conflict(f"予約の受付は開始日時の{hours_label(RESERVATION_DEADLINE_BEFORE)}前で締め切りました")
    if workshop.facilitator_id == user.id:
        raise conflict("自分が主催するワークショップは予約できません")
    online = workshop.payment_method == PaymentMethod.online
    if online:
        ensure_can_accept_online_payment(workshop.facilitator)

    existing = db.scalar(
        select(Reservation).where(Reservation.workshop_id == workshop_id, Reservation.user_id == user.id)
    )
    if existing is not None:
        if existing.status == ReservationStatus.confirmed:
            raise conflict("既に予約済みです")
        if existing.status == ReservationStatus.canceled:
            # キャンセル済みの予約は主催者が取り消したもの。主催者の判断を覆さないよう、再予約させない
            raise conflict("主催者により参加がキャンセルされたため、このワークショップは予約できません")
        current = latest_payment(existing)
        if (
            is_holding_seat(existing.status, existing.payment_expires_at)
            and current is not None
            and current.stripe_checkout_session_id is not None
        ):
            # 支払い画面から戻ってきた人。席は確保したまま、同じ支払いを再開してもらう
            return ReservationStart(reservation=existing, resume_payment=current)
        # 支払われずに期限が過ぎた予約。または支払い画面を作る前に処理が止まった予約
        # (Stripe は作成から 30 分以上先の期限しか受け付けないので、元の期限のまま作り直せない)。
        # 一意制約(1人1ワークショップ1件)があるので、同じ行を使って予約し直す

    if reserved_count(db, workshop_id, excluding_reservation_id=existing.id if existing else None) + (
        payload.ticket_count
    ) > workshop.capacity:
        raise conflict("残席がチケット枚数に満たないため予約できません")

    reservation = existing or Reservation(workshop_id=workshop_id, user_id=user.id)
    # 同じアカウントでは同じ名前で参加する想定なので、参加者名はアカウント名を使う
    reservation.attendee_name = user.name
    reservation.contact = payload.contact
    reservation.ticket_count = payload.ticket_count
    if not online:
        reservation.status = ReservationStatus.confirmed
        db.add(reservation)
        return ReservationStart(reservation=reservation)

    reservation.status = ReservationStatus.pending_payment
    reservation.payment_expires_at = utcnow_naive() + PAYMENT_HOLD
    db.add(reservation)
    # 前回の支払いが期限切れのまま残っていれば、閉じたものとして扱う
    previous = latest_payment(reservation) if existing else None
    if previous is not None and previous.status == PaymentStatus.pending:
        previous.status = PaymentStatus.expired
    payment = add_payment(db, reservation, workshop, workshop.facilitator)
    db.flush()
    return ReservationStart(reservation=reservation, new_payment=payment)


def confirm_paid_checkout(
    db: Session, payment: Payment, *, payment_intent_id: str | None, stripe_fee: int
) -> None:
    """Stripe で支払いが済んだ予約を確定する(commit は呼び出し側)。

    支払いの記録は必ず残す。そのうえで、参加を確定できない場合(支払い中に期限が過ぎて席が埋まった、
    ワークショップが中止になった、別の支払いで予約し直していた など)は全額返金の対象にする。
    Webhook と完了画面からの確認が重なっても二重に反映しないよう、ワークショップ → 予約 → 支払いの順に
    行をロックし、読み直してから判定する(ロックの順序は create_reservation と同じ)
    """
    reservation = _lock_reservation_and_payment(db, payment)
    if payment.status not in _PAYABLE_STATUSES:
        # Webhook の再送や、完了画面からの確認と重なった場合。すでに反映済み
        return
    record_paid(payment, payment_intent_id=payment_intent_id, stripe_fee=stripe_fee)
    workshop = reservation.workshop
    can_confirm = (
        workshop.status == WorkshopStatus.published
        and reservation.status in (ReservationStatus.pending_payment, ReservationStatus.expired)
        and latest_payment(reservation) is payment
        and reserved_count(db, workshop.id, excluding_reservation_id=reservation.id) + reservation.ticket_count
        <= workshop.capacity
    )
    if not can_confirm:
        request_full_refund(payment)
        if _is_current_pending(reservation, payment):
            reservation.status = ReservationStatus.expired
        return
    reservation.status = ReservationStatus.confirmed
    reservation.payment_expires_at = None


def _lock_reservation_and_payment(db: Session, payment: Payment) -> Reservation:
    """支払いの状態を変える前に、ワークショップ → 予約 → 支払いの順に行をロックして読み直す"""
    reservation = payment.reservation
    lock_workshop(db, reservation.workshop_id)
    db.refresh(reservation, with_for_update=True)
    db.refresh(payment, with_for_update=True)
    # 予約し直して支払いが増えていないか(今の支払いか)を正しく判定できるよう、一覧も読み直す
    db.expire(reservation, ["payments"])
    return reservation


def expire_checkout(db: Session, payment: Payment) -> None:
    """支払われないまま閉じた支払いを記録し、その予約の席を手放す(commit は呼び出し側)"""
    reservation = _lock_reservation_and_payment(db, payment)
    if payment.status != PaymentStatus.pending:
        return
    payment.status = PaymentStatus.expired
    if _is_current_pending(reservation, payment):
        reservation.status = ReservationStatus.expired


def apply_checkout_state(db: Session, payment: Payment, state: stripe_client.CheckoutSessionState) -> None:
    """Stripe の Checkout Session の状態を反映する(commit は呼び出し側)。

    Webhook と完了画面からの確認の両方から使う。支払いが済んでいれば Stripe の決済手数料を取得するので、
    Stripe に繋がらなければ StripeUnavailable をそのまま投げる(Webhook なら Stripe が再送する)
    """
    if state.status == "complete" and state.payment_status == "paid":
        # 反映済みなら Stripe に手数料を問い合わせない(最終的な判定はロックの中で confirm_paid_checkout が行う)
        if payment.status not in _PAYABLE_STATUSES:
            return
        stripe_fee = (
            stripe_client.retrieve_stripe_fee(state.payment_intent_id, account_id=payment.stripe_account_id)
            if state.payment_intent_id
            else 0
        )
        confirm_paid_checkout(db, payment, payment_intent_id=state.payment_intent_id, stripe_fee=stripe_fee)
    elif state.status == "expired":
        expire_checkout(db, payment)


def sync_pending_payment(db: Session, reservation: Reservation) -> None:
    """支払い待ちの予約の状態を Stripe から読み直す(commit は呼び出し側)。

    支払いを終えて完了画面に戻ってきたとき、Webhook より先に画面が開くことがあるので確かめる。
    読み直しは補助なので、Stripe に繋がらなければ何もしない(Webhook で反映される)
    """
    payment = latest_payment(reservation)
    if (
        reservation.status != ReservationStatus.pending_payment
        or payment is None
        or payment.status != PaymentStatus.pending
        or payment.stripe_checkout_session_id is None
    ):
        return
    try:
        state = stripe_client.retrieve_checkout_session(
            payment.stripe_checkout_session_id, account_id=payment.stripe_account_id
        )
        apply_checkout_state(db, payment, state)
    except stripe_client.StripeUnavailable:
        return


def abandon_payment(db: Session, reservation: Reservation) -> None:
    """参加者が支払いをやめ、確保していた席をすぐ手放す(commit は呼び出し側)。

    Stripe の支払い画面を閉じてから手放す。閉じられなかった(その間に支払いが済んだなど)ときは
    Stripe の状態を読み直して反映し、まだ支払い待ちなら 409 にする
    """
    if reservation.status != ReservationStatus.pending_payment:
        raise conflict("お支払い待ちの予約ではありません")
    payment = latest_payment(reservation)
    if payment is None or payment.stripe_checkout_session_id is None:
        # 支払い画面を作っている途中。ここで手放すと、作り終えた画面から支払えてしまう
        raise conflict("お支払いの準備中です。少し待ってからもう一度お試しください")
    try:
        stripe_client.expire_checkout_session(
            payment.stripe_checkout_session_id, account_id=payment.stripe_account_id
        )
    except stripe_client.StripeUnavailable:
        sync_pending_payment(db, reservation)
        if reservation.status == ReservationStatus.pending_payment:
            raise conflict("お支払いの取り消しを受け付けられませんでした。時間をおいてもう一度お試しください")
        return
    expire_checkout(db, payment)


def resume_checkout(db: Session, reservation: Reservation, payment: Payment) -> str:
    """支払い待ちの予約の、支払い画面の URL を返す(支払い画面から戻ってきた人が再開するとき)。

    例外として service の中で commit する: Stripe の画面がもう開いていない(支払いが済んだ・閉じた)ときは、
    その状態を反映して確定してから 409 で伝える。Webhook を待たずに、席の確保や予約の確定を実際の状態に合わせるため
    """
    try:
        state = stripe_client.retrieve_checkout_session(
            payment.stripe_checkout_session_id, account_id=payment.stripe_account_id
        )
        if state.status == "open" and state.url is not None:
            return state.url
        apply_checkout_state(db, payment, state)
    except stripe_client.StripeUnavailable as exc:
        raise service_unavailable() from exc
    db.commit()
    raise conflict("お支払いの状態が変わりました。参加予定のワークショップでご確認ください")


def cancel_reservation(
    db: Session, workshop: Workshop, reservation: Reservation, reason: CancelReason
) -> Payment | None:
    """主催者(と運営)が予約をキャンセルし、参加者に通知する(commit は呼び出し側)。

    オンライン決済で支払い済みなら、理由に応じた額を返金の対象にし、その支払いを返す。
    Stripe への返金の依頼は、commit の後に呼び出し側が process_refund で行う。
    予約の受付と同時に走っても残席の数が食い違わないよう、workshop は lock_workshop で取得したものを渡すこと
    """
    if reservation.status == ReservationStatus.canceled:
        raise conflict("この予約は既にキャンセルされています")
    if reservation.status != ReservationStatus.confirmed:
        # 支払い待ち・期限切れは参加が確定しておらず、席は期限が来れば自動で空く
        raise conflict("お支払いが済んでいない予約はキャンセルできません")
    if workshop.status == WorkshopStatus.canceled:
        raise conflict("中止したワークショップの予約はキャンセルできません")
    if workshop.start_at <= utcnow_naive():
        raise conflict("開始済みのワークショップの予約はキャンセルできません")

    reservation.status = ReservationStatus.canceled
    reservation.cancel_reason = reason
    payment = paid_payment(reservation)
    refund_amount = request_refund(payment, reason) if payment is not None else None
    # キャンセル・返金の決定と参加者への通知は、同じトランザクションでまとめて確定する
    add_reservation_canceled_notice(db, reservation, refund_amount=refund_amount, reason=reason)
    return payment


def release_stale_holds(db: Session) -> None:
    """期限を過ぎた支払い待ちの予約を期限切れにする(定期処理。commit は呼び出し側)。

    定員の計算は期限で除外しているので、表示と状態をそろえるための片付け。支払いの記録は Webhook で反映する。
    読んでから書き換えると、その間に支払いが済んで確定した予約を上書きしてしまうので、条件付きの UPDATE 1文で行う
    (READ COMMITTED では、行ロックを取ったあと最新の値で条件を評価し直すので、確定済みの予約は対象から外れる)
    """
    db.execute(
        update(Reservation)
        .where(
            Reservation.status == ReservationStatus.pending_payment,
            Reservation.payment_expires_at <= utcnow_naive(),
        )
        .values(status=ReservationStatus.expired)
        .execution_options(synchronize_session=False)
    )


def record_attendance(workshop: Workshop, reservation: Reservation, attendance: AttendanceStatus) -> None:
    """開催当日の出欠を記録する(commit は呼び出し側)。記録の誤りを直せるよう、開催後も変更できる"""
    if workshop.status != WorkshopStatus.published:
        raise conflict("公開中のワークショップだけ出欠を記録できます")
    if reservation.status != ReservationStatus.confirmed:
        raise conflict("参加が確定していない予約の出欠は記録できません")
    if utcnow_naive() < workshop.start_at - ATTENDANCE_OPEN_BEFORE:
        raise conflict(f"出欠は開始日時の{hours_label(ATTENDANCE_OPEN_BEFORE)}前から記録できます")
    reservation.attendance = attendance


# 複数のワーカー・プロセスで同時に返金を依頼しないための MySQL の名前付きロック
_PAYMENT_JOB_LOCK_NAME = "workshop_app_payment_job"


def run_payment_maintenance(db: Session) -> None:
    """定期処理: 期限を過ぎた支払い待ちを片付け、依頼に失敗した返金を再試行する"""
    with named_lock(db, _PAYMENT_JOB_LOCK_NAME) as got_lock:
        if not got_lock:
            return
        release_stale_holds(db)
        db.commit()
        process_pending_refunds(db)
