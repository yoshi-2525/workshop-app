"""主催者の売上と振込。

参加費は運営の Stripe アカウントで受け取り、支払いごとに主催者の受取額(payments.facilitator_amount)を記録している。
主催者はその合計から振込を申請し、運営が銀行から手動で振り込んで結果を記録する。
残高は列に持たず、支払いと振込申請の記録から毎回計算する(二重に数えたり、記録とずれたりしないように)。
"""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import ColumnElement, Select, func, select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.core.errors import conflict, not_found
from app.core.timeutil import utcnow_naive
from app.models.payment import Payment, PaymentStatus
from app.models.payout import PayoutBankAccount, PayoutRequest, PayoutRequestStatus
from app.models.reservation import Reservation
from app.models.user import User
from app.models.workshop import Workshop, WorkshopStatus
from app.schemas.payment import (
    AdminPayoutRequestRead,
    BankAccountInput,
    BankAccountRead,
    EarningRead,
    PayoutRequestQuery,
    PayoutRequestRead,
    PayoutSummary,
)

PAYOUT_REQUEST_NOT_FOUND = "振込の申請が見つかりません"


@dataclass(frozen=True)
class Balance:
    """主催者の売上と振込の状況(円)。定義はこのモジュールの facilitator_balance だけに置く"""

    settled: int
    upcoming: int
    requested: int
    paid: int

    @property
    def available(self) -> int:
        # 返金を運営が手作業で行った場合などに、記録上マイナスにならないようにする
        return max(0, self.settled - self.requested - self.paid)


# 主催者の売上に数える支払いと、申請できる(開催を終えた)ものの条件。
# SQL 用(_earning_criteria・_settled_clause)と ORM オブジェクト用(_is_counted・_is_settled)を隣に置き、変えるときは両方を直す


def _earning_criteria(user: User) -> tuple[ColumnElement[bool], ...]:
    """主催者の受取額に数える支払い: その主催者の公開中のワークショップで、支払い済みのまま(返金になっていない)もの。

    中止や取消で返金の対象になった支払いは paid ではなくなるので、自然に外れる
    """
    return (
        Workshop.facilitator_id == user.id,
        Workshop.status == WorkshopStatus.published,
        Payment.status == PaymentStatus.paid,
    )


def _settled_clause(now: datetime) -> ColumnElement[bool]:
    """終了日時を過ぎたワークショップ。中止・編集ができなくなる条件(ensure_editable の end_at < now)と揃える"""
    return Workshop.end_at < now


def _is_counted(payment: Payment, workshop: Workshop) -> bool:
    return payment.status == PaymentStatus.paid and workshop.status == WorkshopStatus.published


def _is_settled(workshop: Workshop, now: datetime) -> bool:
    return workshop.end_at < now


def _earnings_sum(db: Session, *criteria: ColumnElement[bool]) -> int:
    stmt = (
        select(func.coalesce(func.sum(Payment.facilitator_amount), 0))
        .join(Reservation, Payment.reservation_id == Reservation.id)
        .join(Workshop, Reservation.workshop_id == Workshop.id)
        .where(*criteria)
    )
    return int(db.scalar(stmt) or 0)


def _requests_sum(db: Session, user: User, status: PayoutRequestStatus) -> int:
    stmt = select(func.coalesce(func.sum(PayoutRequest.amount), 0)).where(
        PayoutRequest.facilitator_id == user.id, PayoutRequest.status == status
    )
    return int(db.scalar(stmt) or 0)


def facilitator_balance(db: Session, user: User) -> Balance:
    """開催を終えた(終了日時を過ぎた)分だけを申請できる額に入れる。

    開催前・開催中は取消や中止で返金になることがあるため。終了日時を過ぎると予約の取消もワークショップの中止も
    できないので、終了後の受取額はもう変わらない
    """
    now = utcnow_naive()
    criteria = _earning_criteria(user)
    return Balance(
        settled=_earnings_sum(db, *criteria, _settled_clause(now)),
        upcoming=_earnings_sum(db, *criteria, ~_settled_clause(now)),
        requested=_requests_sum(db, user, PayoutRequestStatus.requested),
        paid=_requests_sum(db, user, PayoutRequestStatus.paid),
    )


def _has_open_request(db: Session, user: User) -> bool:
    return (
        db.scalar(
            select(PayoutRequest.id).where(
                PayoutRequest.facilitator_id == user.id, PayoutRequest.status == PayoutRequestStatus.requested
            )
        )
        is not None
    )


def _payout_blocker(db: Session, user: User, balance: Balance) -> str | None:
    """振込を申請できない理由。申請できるなら None"""
    if user.payout_bank_account is None:
        return "振込を申請するには、先に振込先の口座を登録してください"
    if _has_open_request(db, user):
        return "申請中の振込があります。振込が済んでから、もう一度申請してください"
    if balance.available < settings.payout_min_amount:
        return f"振込を申請できるのは、申請できる額が {settings.payout_min_amount:,} 円以上のときです"
    return None


def to_payout_summary(db: Session, user: User) -> PayoutSummary:
    balance = facilitator_balance(db, user)
    return PayoutSummary(
        available_amount=balance.available,
        upcoming_amount=balance.upcoming,
        requested_amount=balance.requested,
        paid_amount=balance.paid,
        min_amount=settings.payout_min_amount,
        transfer_fee=settings.payout_transfer_fee,
        can_request=_payout_blocker(db, user, balance) is None,
        online_payment_available=settings.online_payment_enabled,
    )


# ---- 収入の明細 ----


def earnings_select(user: User) -> Select[tuple[Payment]]:
    """主催者のワークショップで支払われた(返金になったものを含む)オンライン決済。終了日時の新しい順"""
    return (
        select(Payment)
        .join(Reservation, Payment.reservation_id == Reservation.id)
        .join(Workshop, Reservation.workshop_id == Workshop.id)
        .where(Workshop.facilitator_id == user.id, Payment.paid_at.is_not(None))
        .options(selectinload(Payment.reservation).selectinload(Reservation.workshop))
        .order_by(Workshop.end_at.desc(), Payment.id.desc())
    )


def to_earning_reads(payments: list[Payment]) -> list[EarningRead]:
    now = utcnow_naive()
    reads = []
    for payment in payments:
        workshop = payment.reservation.workshop
        counted = _is_counted(payment, workshop)
        reads.append(
            EarningRead(
                payment_id=payment.id,
                workshop_id=workshop.id,
                workshop_title=workshop.title,
                workshop_end_at=workshop.end_at,
                attendee_name=payment.reservation.attendee_name,
                status=payment.status,
                amount=payment.amount,
                facilitator_amount=payment.facilitator_amount if counted else 0,
                settled=counted and _is_settled(workshop, now),
                paid_at=payment.paid_at,
            )
        )
    return reads


# ---- 振込先口座 ----


def to_bank_account_read(account: PayoutBankAccount | PayoutRequest) -> BankAccountRead:
    return BankAccountRead.model_validate(account)


def upsert_bank_account(db: Session, user: User, payload: BankAccountInput) -> PayoutBankAccount:
    """振込先口座を登録・変更する(commit は呼び出し側)。申請中の振込の振込先は申請時のまま変わらない。

    初めての登録が同時に2回来ても一意制約の違反にならないよう、ユーザーの行をロックしてから確かめる
    """
    db.refresh(user, with_for_update=True)
    account = user.payout_bank_account
    if account is None:
        account = PayoutBankAccount(user_id=user.id)
        db.add(account)
        user.payout_bank_account = account
    for field, value in payload.model_dump().items():
        setattr(account, field, value)
    account.updated_at = utcnow_naive()
    return account


# ---- 振込の申請 ----


def request_payout(db: Session, user: User) -> PayoutRequest:
    """申請できる額の全額で振込を申請する(commit は呼び出し側)。

    同じ主催者の同時の申請で残高を二重に使わないよう、ユーザーの行をロックしてから残高を計算する(commit まで保持)。
    振込先は申請時の口座を写して残す
    """
    db.refresh(user, with_for_update=True)
    balance = facilitator_balance(db, user)
    blocker = _payout_blocker(db, user, balance)
    if blocker is not None:
        raise conflict(blocker)
    fee = settings.payout_transfer_fee
    request = PayoutRequest(
        facilitator_id=user.id,
        amount=balance.available,
        transfer_fee=fee,
        transfer_amount=balance.available - fee,
        status=PayoutRequestStatus.requested,
        note="",
        **to_bank_account_read(user.payout_bank_account).model_dump(),
    )
    db.add(request)
    return request


def my_payout_requests_select(user: User) -> Select[tuple[PayoutRequest]]:
    return (
        select(PayoutRequest)
        .where(PayoutRequest.facilitator_id == user.id)
        .order_by(PayoutRequest.requested_at.desc(), PayoutRequest.id.desc())
    )


def _request_fields(request: PayoutRequest) -> dict:
    return {
        "id": request.id,
        "amount": request.amount,
        "transfer_fee": request.transfer_fee,
        "transfer_amount": request.transfer_amount,
        "status": request.status,
        "note": request.note,
        "requested_at": request.requested_at,
        "processed_at": request.processed_at,
        "bank_account": to_bank_account_read(request),
    }


def to_payout_request_reads(requests: list[PayoutRequest]) -> list[PayoutRequestRead]:
    return [PayoutRequestRead(**_request_fields(r)) for r in requests]


# ---- 運営の振込の処理 ----


def admin_payout_requests_select(query: PayoutRequestQuery) -> Select[tuple[PayoutRequest]]:
    """運営向けの振込申請の一覧。申請の古い順(先に申請されたものから振り込むため)"""
    stmt = select(PayoutRequest).options(selectinload(PayoutRequest.facilitator))
    if query.status is not None:
        stmt = stmt.where(PayoutRequest.status == query.status)
    return stmt.order_by(PayoutRequest.requested_at.asc(), PayoutRequest.id.asc())


def to_admin_payout_request_reads(requests: list[PayoutRequest]) -> list[AdminPayoutRequestRead]:
    return [
        AdminPayoutRequestRead(
            **_request_fields(r),
            facilitator_id=r.facilitator_id,
            facilitator_name=r.facilitator.name,
            facilitator_email=r.facilitator.email,
        )
        for r in requests
    ]


def get_open_payout_request(db: Session, request_id: int) -> PayoutRequest:
    """運営が処理する申請中の振込申請を、行をロックして取得する(同じ申請を二重に処理しないため)"""
    request = db.get(PayoutRequest, request_id, with_for_update=True, populate_existing=True)
    if request is None:
        raise not_found(PAYOUT_REQUEST_NOT_FOUND)
    if request.status != PayoutRequestStatus.requested:
        raise conflict("この申請は既に処理されています")
    return request


def _close_request(request: PayoutRequest, status: PayoutRequestStatus, note: str) -> None:
    request.status = status
    request.note = note
    request.processed_at = utcnow_naive()


def mark_payout_paid(request: PayoutRequest, note: str) -> None:
    """運営が振り込んだことを記録する(commit は呼び出し側)。銀行での振込を終えてから行う"""
    _close_request(request, PayoutRequestStatus.paid, note)


def reject_payout(request: PayoutRequest, note: str) -> None:
    """振り込まずに申請を取り下げる(commit は呼び出し側)。申請額は主催者の申請できる額に戻る"""
    _close_request(request, PayoutRequestStatus.rejected, note)
