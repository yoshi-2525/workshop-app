"""オンライン決済の返金: 主催者による予約の取消(理由ごとの返金額)・ワークショップの中止・返金の再試行と失敗・返金完了の通知。

Stripe は呼ばず、app.core.stripe_client の関数を差し替えて確かめる
"""

from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.core import stripe_client
from app.core.stripe_client import StripeUnavailable
from app.core.timeutil import utcnow_naive
from app.models.notification import Notification, NotificationType
from app.models.payment import Payment, PaymentStatus
from app.models.reservation import CancelReason, Reservation, ReservationStatus
from app.models.user import User, UserRole
from app.models.workshop import PaymentMethod, Workshop
from app.services.payments import MAX_REFUND_ATTEMPTS, process_pending_refunds
from app.services.reservations import release_stale_holds
from tests.conftest import auth_headers

PRICE = 3000
STRIPE_FEE = 108
PLATFORM_FEE = 300


@pytest.fixture(autouse=True)
def _stripe_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_dummy")


class FakeRefunds:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []
        self.expired: list[str] = []
        self.fail = False
        # Stripe 上にすでにある返金(応答を受け取れなかった依頼)
        self.existing_refund: str | None = None

    def find_active_refund(self, **_kwargs: Any) -> str | None:
        return self.existing_refund

    def create_refund(self, **kwargs: Any) -> str:
        if self.fail:
            raise StripeUnavailable("down")
        self.calls.append(kwargs)
        return f"re_{len(self.calls)}"

    def expire_checkout_session(self, session_id: str) -> Any:
        self.expired.append(session_id)


@pytest.fixture
def fake_refunds(monkeypatch: pytest.MonkeyPatch) -> FakeRefunds:
    fake = FakeRefunds()
    monkeypatch.setattr(stripe_client, "create_refund", fake.create_refund)
    monkeypatch.setattr(stripe_client, "find_active_refund", fake.find_active_refund)
    monkeypatch.setattr(stripe_client, "expire_checkout_session", fake.expire_checkout_session)
    return fake


@pytest.fixture
def facilitator(make_user: Callable[..., User]) -> User:
    return make_user(UserRole.facilitator)


@pytest.fixture
def online_workshop(make_workshop: Callable[..., Workshop], facilitator: User) -> Workshop:
    return make_workshop(facilitator, price=PRICE, payment_method=PaymentMethod.online)


@pytest.fixture
def paid_reservation(db: Session, make_user: Callable[..., User], online_workshop: Workshop) -> Reservation:
    """オンライン決済で支払い済みの予約(1枚)"""
    reservation = Reservation(
        workshop_id=online_workshop.id,
        user_id=make_user().id,
        attendee_name="参加者",
        contact="p@example.com",
        ticket_count=1,
        status=ReservationStatus.confirmed,
    )
    db.add(reservation)
    db.flush()
    db.add(
        Payment(
            reservation_id=reservation.id,
            stripe_checkout_session_id=f"cs_{reservation.id}",
            stripe_payment_intent_id=f"pi_{reservation.id}",
            amount=PRICE,
            platform_fee_amount=PLATFORM_FEE,
            facilitator_amount=PRICE - PLATFORM_FEE,
            stripe_fee_amount=STRIPE_FEE,
            status=PaymentStatus.paid,
            paid_at=utcnow_naive(),
        )
    )
    db.commit()
    return reservation


def _payment(db: Session, reservation: Reservation) -> Payment:
    db.expire_all()
    return db.scalar(select(Payment).where(Payment.reservation_id == reservation.id))


def _cancel(client: TestClient, workshop: Workshop, reservation: Reservation, user: User, reason: str | None):
    body = {} if reason is None else {"reason": reason}
    return client.post(
        f"/api/workshops/{workshop.id}/reservations/{reservation.id}/cancel", json=body, headers=auth_headers(user)
    )


def _notice(db: Session, reservation: Reservation, type_: NotificationType) -> Notification | None:
    return db.scalar(
        select(Notification).where(Notification.user_id == reservation.user_id, Notification.type == type_)
    )


class TestCancelReservationRefund:
    def test_facilitator_reason_refunds_in_full(
        self, client, db, facilitator, online_workshop, paid_reservation, fake_refunds
    ) -> None:
        res = _cancel(client, online_workshop, paid_reservation, facilitator, "facilitator")

        assert res.status_code == 200
        assert res.json()["cancel_reason"] == "facilitator"
        assert fake_refunds.calls == [
            {
                "payment_intent_id": f"pi_{paid_reservation.id}",
                "amount": PRICE,
                "idempotency_key": f"refund-payment-{_payment(db, paid_reservation).id}-0",
                "metadata": {"payment_id": str(_payment(db, paid_reservation).id)},
            }
        ]
        assert _payment(db, paid_reservation).stripe_refund_id == "re_1"
        payment = _payment(db, paid_reservation)
        assert payment.status == PaymentStatus.refunded
        assert payment.refund_amount == PRICE
        assert "全額返金" in _notice(db, paid_reservation, NotificationType.reservation_canceled).message
        assert "3,000円を返金しました" in _notice(db, paid_reservation, NotificationType.payment_refunded).message

    def test_participant_reason_deducts_fees(
        self, client, db, facilitator, online_workshop, paid_reservation, fake_refunds
    ) -> None:
        res = _cancel(client, online_workshop, paid_reservation, facilitator, "participant")

        assert res.status_code == 200
        expected = PRICE - STRIPE_FEE - PLATFORM_FEE
        assert fake_refunds.calls[0]["amount"] == expected
        assert _payment(db, paid_reservation).refund_amount == expected
        canceled = _notice(db, paid_reservation, NotificationType.reservation_canceled)
        assert "参加者のご都合" in canceled.message and f"{expected:,}円" in canceled.message

    def test_nothing_left_after_fees_skips_stripe(
        self, client, db, facilitator, online_workshop, paid_reservation, fake_refunds
    ) -> None:
        payment = _payment(db, paid_reservation)
        payment.stripe_fee_amount = PRICE - PLATFORM_FEE
        db.commit()

        _cancel(client, online_workshop, paid_reservation, facilitator, "participant")

        assert fake_refunds.calls == []
        payment = _payment(db, paid_reservation)
        assert payment.status == PaymentStatus.refunded and payment.refund_amount == 0
        assert _notice(db, paid_reservation, NotificationType.payment_refunded) is None
        assert "0円を返金" not in _notice(db, paid_reservation, NotificationType.reservation_canceled).message

    def test_onsite_reservation_has_no_refund(
        self, client, db, make_user, make_workshop, facilitator, fake_refunds
    ) -> None:
        workshop = make_workshop(facilitator, price=PRICE)
        participant = make_user()
        reservation_id = client.post(
            f"/api/workshops/{workshop.id}/reservations",
            json={"contact": "p@example.com", "ticket_count": 1},
            headers=auth_headers(participant),
        ).json()["reservation"]["id"]
        reservation = db.get(Reservation, reservation_id)

        assert _cancel(client, workshop, reservation, facilitator, "participant").status_code == 200
        assert fake_refunds.calls == []
        assert "返金" not in _notice(db, reservation, NotificationType.reservation_canceled).message

    def test_reason_is_required(self, client, facilitator, online_workshop, paid_reservation, fake_refunds) -> None:
        assert _cancel(client, online_workshop, paid_reservation, facilitator, None).status_code == 422

    def test_stripe_failure_keeps_cancel_and_retries_later(
        self, client, db, facilitator, online_workshop, paid_reservation, fake_refunds
    ) -> None:
        fake_refunds.fail = True

        res = _cancel(client, online_workshop, paid_reservation, facilitator, "facilitator")

        # 取消は確定し、返金は待ちのまま残る
        assert res.status_code == 200
        assert res.json()["status"] == "canceled"
        payment = _payment(db, paid_reservation)
        assert payment.status == PaymentStatus.refund_pending
        assert payment.refund_attempts == 1

        fake_refunds.fail = False
        process_pending_refunds(db)
        assert _payment(db, paid_reservation).status == PaymentStatus.refunded
        # 再試行は、試行回数を含めた新しい冪等キーで依頼する(同じキーでは前回の失敗が返るため)
        assert fake_refunds.calls[-1]["idempotency_key"].endswith("-1")

    def test_retry_does_not_refund_twice_when_stripe_already_has_it(
        self, client, db, facilitator, online_workshop, paid_reservation, fake_refunds
    ) -> None:
        fake_refunds.fail = True
        _cancel(client, online_workshop, paid_reservation, facilitator, "facilitator")
        # 前回の依頼は Stripe に届いていた(応答だけを受け取れなかった)
        fake_refunds.fail = False
        fake_refunds.existing_refund = "re_earlier"

        process_pending_refunds(db)

        assert fake_refunds.calls == []
        payment = _payment(db, paid_reservation)
        assert payment.status == PaymentStatus.refunded
        assert payment.stripe_refund_id == "re_earlier"

    def test_not_attempted_while_online_payment_is_disabled(
        self, client, db, facilitator, online_workshop, paid_reservation, fake_refunds, monkeypatch
    ) -> None:
        monkeypatch.setattr(settings, "stripe_secret_key", "")
        _cancel(client, online_workshop, paid_reservation, facilitator, "facilitator")
        payment = _payment(db, paid_reservation)
        assert payment.status == PaymentStatus.refund_pending
        assert payment.refund_attempts == 0

    def test_gives_up_after_max_attempts(
        self, client, db, facilitator, online_workshop, paid_reservation, fake_refunds
    ) -> None:
        fake_refunds.fail = True
        _cancel(client, online_workshop, paid_reservation, facilitator, "facilitator")
        for _ in range(MAX_REFUND_ATTEMPTS - 1):
            process_pending_refunds(db)

        payment = _payment(db, paid_reservation)
        assert payment.status == PaymentStatus.refund_failed
        assert payment.refund_attempts == MAX_REFUND_ATTEMPTS


class TestCancelWorkshopRefund:
    def test_refunds_all_paid_in_full_and_closes_open_checkouts(
        self, client, db, make_user, facilitator, online_workshop, paid_reservation, fake_refunds
    ) -> None:
        pending = Reservation(
            workshop_id=online_workshop.id,
            user_id=make_user().id,
            contact="q@example.com",
            ticket_count=1,
            status=ReservationStatus.pending_payment,
            payment_expires_at=utcnow_naive().replace(year=2099),
        )
        db.add(pending)
        db.flush()
        db.add(
            Payment(
                reservation_id=pending.id,
                stripe_checkout_session_id="cs_open",
                amount=PRICE,
                platform_fee_amount=PLATFORM_FEE,
            facilitator_amount=PRICE - PLATFORM_FEE,
                status=PaymentStatus.pending,
            )
        )
        db.commit()

        res = client.post(f"/api/workshops/{online_workshop.id}/cancel", headers=auth_headers(facilitator))

        assert res.status_code == 200
        assert [c["amount"] for c in fake_refunds.calls] == [PRICE]
        assert _payment(db, paid_reservation).status == PaymentStatus.refunded
        # 中止は予約の取消ではないので、予約は確定のまま残し取消の理由も入れない
        reservation = db.get(Reservation, paid_reservation.id)
        assert reservation.status == ReservationStatus.confirmed and reservation.cancel_reason is None
        assert "全額返金" in _notice(db, paid_reservation, NotificationType.cancellation).message
        # 支払い待ちの席は手放し、支払い画面も閉じる
        assert fake_refunds.expired == ["cs_open"]
        assert db.get(Reservation, pending.id).status == ReservationStatus.expired


class TestRefundWebhook:
    def test_failed_refund_is_recorded(
        self, client, db, facilitator, online_workshop, paid_reservation, fake_refunds, monkeypatch
    ) -> None:
        _cancel(client, online_workshop, paid_reservation, facilitator, "facilitator")
        event = {
            "id": "evt_refund_failed",
            "type": "charge.refund.updated",
            "data": {"object": {"id": "re_1", "status": "failed", "payment_intent": f"pi_{paid_reservation.id}"}},
        }
        monkeypatch.setattr(stripe_client, "construct_event", lambda _payload, _sig: event)

        res = client.post("/api/stripe/webhook", content=b"{}", headers={"stripe-signature": "t=1,v1=x"})

        assert res.status_code == 204
        assert _payment(db, paid_reservation).status == PaymentStatus.refund_failed
        # 返金済みと知らせていたので、完了できなかったことも知らせる
        assert _notice(db, paid_reservation, NotificationType.payment_refund_failed) is not None



    def test_failed_refund_not_requested_by_app_keeps_payment(
        self, client, db, paid_reservation, monkeypatch
    ) -> None:
        """ダッシュボードからの返金の失敗などで、支払い済みの売上を消さない"""
        event = {
            "id": "evt_refund_failed_dashboard",
            "type": "charge.refund.updated",
            "data": {"object": {"id": "re_x", "status": "failed", "payment_intent": f"pi_{paid_reservation.id}"}},
        }
        monkeypatch.setattr(stripe_client, "construct_event", lambda _payload, _sig: event)
        client.post("/api/stripe/webhook", content=b"{}", headers={"stripe-signature": "t=1,v1=x"})
        assert _payment(db, paid_reservation).status == PaymentStatus.paid


class TestReleaseStaleHolds:
    def test_only_expired_pending_holds_are_released(self, db, make_user, online_workshop) -> None:
        past = utcnow_naive().replace(year=2000)
        stale = Reservation(
            workshop_id=online_workshop.id, user_id=make_user().id, contact="a@example.com",
            status=ReservationStatus.pending_payment, payment_expires_at=past,
        )
        # 期限の後に支払いが済んで確定した予約(書き換えてはいけない)
        confirmed = Reservation(
            workshop_id=online_workshop.id, user_id=make_user().id, contact="b@example.com",
            status=ReservationStatus.confirmed, payment_expires_at=past,
        )
        db.add_all([stale, confirmed])
        db.commit()

        release_stale_holds(db)
        db.commit()

        db.expire_all()
        assert db.get(Reservation, stale.id).status == ReservationStatus.expired
        assert db.get(Reservation, confirmed.id).status == ReservationStatus.confirmed
