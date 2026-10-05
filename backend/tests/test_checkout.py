"""オンライン決済での予約(Stripe Checkout)・決済完了の反映(Webhook と完了画面からの確認)・支払いの取りやめ。

Stripe は呼ばず、app.core.stripe_client の関数を差し替えて確かめる
"""

from collections.abc import Callable
from datetime import timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.core import stripe_client
from app.core.stripe_client import CheckoutSessionState, StripeUnavailable
from app.core.timeutil import utcnow_naive
from app.models.payment import Payment, PaymentStatus
from app.models.reservation import Reservation, ReservationStatus
from app.models.stripe_event import StripeEvent
from app.models.user import User, UserRole
from app.models.workshop import PaymentMethod, Workshop, WorkshopStatus
from tests.conftest import auth_headers, workshop_payload

PRICE = 3000
ACCOUNT = "acct_facilitator"


@pytest.fixture(autouse=True)
def _stripe_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_dummy")
    monkeypatch.setattr(settings, "frontend_base_url", "http://front.example")
    monkeypatch.setattr(settings, "platform_fee_percent", 10)


class FakeStripe:
    """Checkout の作成・取得・期限切れと決済手数料の取得を記録し、決まった値を返す"""

    def __init__(self) -> None:
        self.created: list[dict[str, Any]] = []
        self.expired: list[str] = []
        self.sessions: dict[str, CheckoutSessionState] = {}
        self.fail_create = False
        self.stripe_fee = 108

    def create_checkout_session(self, **kwargs: Any) -> CheckoutSessionState:
        if self.fail_create:
            raise StripeUnavailable("down")
        self.created.append(kwargs)
        session_id = f"cs_{len(self.created)}"
        state = CheckoutSessionState(
            session_id=session_id,
            status="open",
            payment_status="unpaid",
            payment_intent_id=None,
            url=f"https://checkout.stripe.com/c/pay/{session_id}",
        )
        self.sessions[session_id] = state
        return state

    def retrieve_checkout_session(self, session_id: str, *, account_id: str) -> CheckoutSessionState:
        return self.sessions[session_id]

    def expire_checkout_session(self, session_id: str, *, account_id: str) -> CheckoutSessionState:
        self.expired.append(session_id)
        state = CheckoutSessionState(session_id, "expired", "unpaid", None, None)
        self.sessions[session_id] = state
        return state

    def retrieve_stripe_fee(self, payment_intent_id: str, *, account_id: str) -> int:
        return self.stripe_fee

    def complete(self, session_id: str) -> CheckoutSessionState:
        """参加者が支払いを済ませた状態にする"""
        state = CheckoutSessionState(session_id, "complete", "paid", f"pi_{session_id}", None)
        self.sessions[session_id] = state
        return state


@pytest.fixture
def fake_stripe(monkeypatch: pytest.MonkeyPatch) -> FakeStripe:
    fake = FakeStripe()
    for name in (
        "create_checkout_session",
        "retrieve_checkout_session",
        "expire_checkout_session",
        "retrieve_stripe_fee",
    ):
        monkeypatch.setattr(stripe_client, name, getattr(fake, name))
    return fake


@pytest.fixture
def facilitator(db: Session, make_user: Callable[..., User]) -> User:
    user = make_user(UserRole.facilitator)
    user.stripe_account_id = ACCOUNT
    user.stripe_charges_enabled = True
    db.commit()
    return user


@pytest.fixture
def online_workshop(make_workshop: Callable[..., Workshop], facilitator: User) -> Workshop:
    return make_workshop(facilitator, price=PRICE, payment_method=PaymentMethod.online, capacity=3)


def _reserve(client: TestClient, workshop_id: int, user: User, ticket_count: int = 1):
    return client.post(
        f"/api/workshops/{workshop_id}/reservations",
        json={"contact": "me@example.com", "ticket_count": ticket_count},
        headers=auth_headers(user),
    )


def _webhook(client: TestClient, monkeypatch: pytest.MonkeyPatch, event: dict[str, Any]):
    """署名の確認を差し替えて、イベントをそのまま受け取らせる"""
    monkeypatch.setattr(stripe_client, "construct_event", lambda _payload, _sig: event)
    return client.post("/api/stripe/webhook", content=b"{}", headers={"stripe-signature": "t=1,v1=x"})


def _checkout_event(event_id: str, kind: str, state: CheckoutSessionState, account: str = ACCOUNT) -> dict[str, Any]:
    return {
        "id": event_id,
        "type": f"checkout.session.{kind}",
        "account": account,
        "data": {
            "object": {
                "id": state.session_id,
                "status": state.status,
                "payment_status": state.payment_status,
                "payment_intent": state.payment_intent_id,
            }
        },
    }


def _payments(db: Session, reservation_id: int) -> list[Payment]:
    db.expire_all()
    return list(db.scalars(select(Payment).where(Payment.reservation_id == reservation_id).order_by(Payment.id)))


class TestStartCheckout:
    def test_holds_seat_and_returns_checkout_url(
        self, client: TestClient, db: Session, make_user, online_workshop: Workshop, fake_stripe: FakeStripe
    ) -> None:
        res = _reserve(client, online_workshop.id, make_user(), ticket_count=2)

        assert res.status_code == 201
        body = res.json()
        assert body["checkout_url"] == "https://checkout.stripe.com/c/pay/cs_1"
        assert body["reservation"]["status"] == "pending_payment"
        assert body["reservation"]["payment"]["amount"] == PRICE * 2
        # 手数料の内訳は主催者が負担するものなので、参加者には返さない
        assert body["reservation"]["payment"]["application_fee_amount"] is None
        assert _payments(db, body["reservation"]["id"])[0].application_fee_amount == PRICE * 2 // 10
        # 支払い待ちの間も席を確保している
        assert body["reservation"]["workshop"]["reserved_count"] == 2
        assert body["reservation"]["workshop"]["viewer"]["is_payment_pending"] is True

        created = fake_stripe.created[0]
        assert created["account_id"] == ACCOUNT
        assert created["item"].unit_amount == PRICE and created["item"].quantity == 2
        assert created["application_fee_amount"] == 600
        reservation_id = body["reservation"]["id"]
        assert created["success_url"] == f"http://front.example/reservations/{reservation_id}/payment/complete"
        assert created["cancel_url"] == f"http://front.example/workshops/{online_workshop.id}/reserve?payment=canceled"
        assert _payments(db, reservation_id)[0].stripe_checkout_session_id == "cs_1"

    def test_onsite_workshop_is_confirmed_without_checkout(
        self, client: TestClient, make_user, make_workshop, facilitator: User, fake_stripe: FakeStripe
    ) -> None:
        workshop = make_workshop(facilitator, price=PRICE)
        res = _reserve(client, workshop.id, make_user())
        assert res.status_code == 201
        assert res.json()["checkout_url"] is None
        assert res.json()["reservation"]["status"] == "confirmed"
        assert res.json()["reservation"]["payment"] is None
        assert fake_stripe.created == []

    def test_pending_hold_counts_toward_capacity(
        self, client: TestClient, make_user, online_workshop: Workshop, fake_stripe: FakeStripe
    ) -> None:
        assert _reserve(client, online_workshop.id, make_user(), ticket_count=3).status_code == 201
        assert _reserve(client, online_workshop.id, make_user()).status_code == 409

    def test_expired_hold_frees_seat(
        self, client: TestClient, db: Session, make_user, online_workshop: Workshop, fake_stripe: FakeStripe
    ) -> None:
        reservation_id = _reserve(client, online_workshop.id, make_user(), ticket_count=3).json()["reservation"]["id"]
        reservation = db.get(Reservation, reservation_id)
        reservation.payment_expires_at = utcnow_naive() - timedelta(minutes=1)
        db.commit()

        assert _reserve(client, online_workshop.id, make_user(), ticket_count=3).status_code == 201

    def test_returning_while_pending_resumes_same_checkout(
        self, client: TestClient, make_user, online_workshop: Workshop, fake_stripe: FakeStripe
    ) -> None:
        participant = make_user()
        first = _reserve(client, online_workshop.id, participant)
        again = _reserve(client, online_workshop.id, participant)

        assert again.status_code == 201
        assert again.json()["checkout_url"] == first.json()["checkout_url"]
        assert len(fake_stripe.created) == 1

    def test_expired_reservation_is_reused_with_new_payment(
        self, client: TestClient, db: Session, make_user, online_workshop: Workshop, fake_stripe: FakeStripe
    ) -> None:
        participant = make_user()
        reservation_id = _reserve(client, online_workshop.id, participant).json()["reservation"]["id"]
        reservation = db.get(Reservation, reservation_id)
        reservation.payment_expires_at = utcnow_naive() - timedelta(minutes=1)
        db.commit()

        res = _reserve(client, online_workshop.id, participant, ticket_count=2)

        assert res.status_code == 201
        assert res.json()["reservation"]["id"] == reservation_id
        assert res.json()["checkout_url"].endswith("cs_2")
        payments = _payments(db, reservation_id)
        assert [p.status for p in payments] == [PaymentStatus.expired, PaymentStatus.pending]
        assert payments[1].amount == PRICE * 2

    def test_stripe_failure_releases_seat(
        self, client: TestClient, db: Session, make_user, online_workshop: Workshop, fake_stripe: FakeStripe
    ) -> None:
        fake_stripe.fail_create = True
        participant = make_user()

        res = _reserve(client, online_workshop.id, participant, ticket_count=3)

        assert res.status_code == 503
        reservation = db.scalar(select(Reservation).where(Reservation.user_id == participant.id))
        assert reservation.status == ReservationStatus.expired
        fake_stripe.fail_create = False
        assert _reserve(client, online_workshop.id, make_user(), ticket_count=3).status_code == 201

    def test_pending_without_checkout_is_restarted_with_new_payment(
        self, client: TestClient, db: Session, make_user, online_workshop: Workshop, fake_stripe: FakeStripe
    ) -> None:
        """支払い画面を作る前に処理が止まった予約は、元の期限のまま作り直せないので新しい支払いで予約し直す"""
        participant = make_user()
        reservation_id = _reserve(client, online_workshop.id, participant).json()["reservation"]["id"]
        payment = _payments(db, reservation_id)[0]
        payment.stripe_checkout_session_id = None
        db.commit()

        res = _reserve(client, online_workshop.id, participant)

        assert res.status_code == 201
        assert res.json()["checkout_url"].endswith("cs_2")
        assert [p.status for p in _payments(db, reservation_id)] == [PaymentStatus.expired, PaymentStatus.pending]

    def test_resume_after_payment_completed_reflects_and_is_409(
        self, client: TestClient, db: Session, make_user, online_workshop: Workshop, fake_stripe: FakeStripe
    ) -> None:
        participant = make_user()
        reservation_id = _reserve(client, online_workshop.id, participant).json()["reservation"]["id"]
        fake_stripe.complete("cs_1")

        res = _reserve(client, online_workshop.id, participant)

        assert res.status_code == 409
        db.expire_all()
        assert db.get(Reservation, reservation_id).status == ReservationStatus.confirmed

    def test_fees_are_shown_to_facilitator(
        self, client: TestClient, make_user, online_workshop: Workshop, facilitator: User, fake_stripe: FakeStripe
    ) -> None:
        _reserve(client, online_workshop.id, make_user())
        res = client.get(f"/api/workshops/{online_workshop.id}/reservations", headers=auth_headers(facilitator))
        assert res.json()[0]["payment"]["application_fee_amount"] == PRICE // 10

    def test_facilitator_without_payout_account_is_409(
        self, client: TestClient, db: Session, make_user, online_workshop: Workshop, facilitator: User, fake_stripe
    ) -> None:
        facilitator.stripe_charges_enabled = False
        db.commit()
        assert _reserve(client, online_workshop.id, make_user()).status_code == 409
        assert fake_stripe.created == []


class TestCheckoutWebhook:
    def _start(self, client: TestClient, make_user, workshop: Workshop, ticket_count: int = 1) -> int:
        return _reserve(client, workshop.id, make_user(), ticket_count).json()["reservation"]["id"]

    def test_completed_confirms_reservation(
        self, client: TestClient, db: Session, make_user, online_workshop, fake_stripe, monkeypatch
    ) -> None:
        reservation_id = self._start(client, make_user, online_workshop)

        res = _webhook(client, monkeypatch, _checkout_event("evt_1", "completed", fake_stripe.complete("cs_1")))

        assert res.status_code == 204
        payment = _payments(db, reservation_id)[0]
        assert payment.status == PaymentStatus.paid
        assert payment.stripe_payment_intent_id == "pi_cs_1"
        assert payment.stripe_fee_amount == 108
        reservation = db.get(Reservation, reservation_id)
        assert reservation.status == ReservationStatus.confirmed
        assert reservation.payment_expires_at is None

    def test_same_event_is_applied_once(
        self, client: TestClient, db: Session, make_user, online_workshop, fake_stripe, monkeypatch
    ) -> None:
        self._start(client, make_user, online_workshop)
        event = _checkout_event("evt_1", "completed", fake_stripe.complete("cs_1"))

        assert _webhook(client, monkeypatch, event).status_code == 204
        assert _webhook(client, monkeypatch, event).status_code == 204
        assert db.scalar(select(StripeEvent).where(StripeEvent.event_id == "evt_1")) is not None

    def test_expired_releases_seat(
        self, client: TestClient, db: Session, make_user, online_workshop, fake_stripe, monkeypatch
    ) -> None:
        reservation_id = self._start(client, make_user, online_workshop, ticket_count=3)
        state = CheckoutSessionState("cs_1", "expired", "unpaid", None, None)

        _webhook(client, monkeypatch, _checkout_event("evt_1", "expired", state))

        db.expire_all()
        assert db.get(Reservation, reservation_id).status == ReservationStatus.expired
        assert _payments(db, reservation_id)[0].status == PaymentStatus.expired
        assert _reserve(client, online_workshop.id, make_user(), ticket_count=3).status_code == 201

    def test_late_payment_after_seat_taken_is_refunded(
        self, client: TestClient, db: Session, make_user, online_workshop, fake_stripe, monkeypatch
    ) -> None:
        """期限が過ぎて席が埋まった後に支払いが届いたら、参加は確定せず全額返金の対象にする"""
        reservation_id = self._start(client, make_user, online_workshop, ticket_count=3)
        reservation = db.get(Reservation, reservation_id)
        reservation.payment_expires_at = utcnow_naive() - timedelta(minutes=1)
        db.commit()
        _reserve(client, online_workshop.id, make_user(), ticket_count=3)

        _webhook(client, monkeypatch, _checkout_event("evt_1", "completed", fake_stripe.complete("cs_1")))

        db.expire_all()
        payment = _payments(db, reservation_id)[0]
        assert payment.status == PaymentStatus.refund_pending
        assert payment.refund_amount == PRICE * 3
        assert db.get(Reservation, reservation_id).status == ReservationStatus.expired

    def test_late_payment_with_free_seat_is_confirmed(
        self, client: TestClient, db: Session, make_user, online_workshop, fake_stripe, monkeypatch
    ) -> None:
        reservation_id = self._start(client, make_user, online_workshop)
        reservation = db.get(Reservation, reservation_id)
        reservation.payment_expires_at = utcnow_naive() - timedelta(minutes=1)
        db.commit()

        _webhook(client, monkeypatch, _checkout_event("evt_1", "completed", fake_stripe.complete("cs_1")))

        db.expire_all()
        assert db.get(Reservation, reservation_id).status == ReservationStatus.confirmed

    def test_payment_for_canceled_workshop_is_refunded(
        self, client: TestClient, db: Session, make_user, online_workshop, fake_stripe, monkeypatch
    ) -> None:
        reservation_id = self._start(client, make_user, online_workshop)
        online_workshop = db.get(Workshop, online_workshop.id)
        online_workshop.status = WorkshopStatus.canceled
        db.commit()

        _webhook(client, monkeypatch, _checkout_event("evt_1", "completed", fake_stripe.complete("cs_1")))

        assert _payments(db, reservation_id)[0].status == PaymentStatus.refund_pending

    def test_event_from_another_account_is_ignored(
        self, client: TestClient, db: Session, make_user, online_workshop, fake_stripe, monkeypatch
    ) -> None:
        reservation_id = self._start(client, make_user, online_workshop)
        event = _checkout_event("evt_1", "completed", fake_stripe.complete("cs_1"), account="acct_other")

        assert _webhook(client, monkeypatch, event).status_code == 204
        assert _payments(db, reservation_id)[0].status == PaymentStatus.pending

    def test_fee_lookup_failure_asks_stripe_to_retry(
        self, client: TestClient, db: Session, make_user, online_workshop, fake_stripe, monkeypatch
    ) -> None:
        reservation_id = self._start(client, make_user, online_workshop)

        def fail(*_args: Any, **_kwargs: Any) -> int:
            raise StripeUnavailable("down")

        monkeypatch.setattr(stripe_client, "retrieve_stripe_fee", fail)
        event = _checkout_event("evt_1", "completed", fake_stripe.complete("cs_1"))

        assert _webhook(client, monkeypatch, event).status_code == 503
        # 記録されていないので、再送されたら処理される
        assert db.scalar(select(StripeEvent)) is None
        assert _payments(db, reservation_id)[0].status == PaymentStatus.pending

    def test_missing_signature_is_400(self, client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(settings, "stripe_webhook_secret", "whsec_test")
        assert client.post("/api/stripe/webhook", content=b"{}").status_code == 400

    def test_invalid_signature_is_400(self, client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(settings, "stripe_webhook_secret", "whsec_test")
        res = client.post("/api/stripe/webhook", content=b"{}", headers={"stripe-signature": "t=1,v1=bad"})
        assert res.status_code == 400

    def test_account_updated_syncs_facilitator(
        self, client: TestClient, db: Session, facilitator: User, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        event = {
            "id": "evt_acct",
            "type": "account.updated",
            "account": ACCOUNT,
            "data": {"object": {"id": ACCOUNT, "charges_enabled": False, "details_submitted": True}},
        }
        assert _webhook(client, monkeypatch, event).status_code == 204
        db.refresh(facilitator)
        assert facilitator.stripe_charges_enabled is False


class TestReservationStatusPage:
    def test_syncs_completed_checkout(
        self, client: TestClient, db: Session, make_user, online_workshop, fake_stripe: FakeStripe
    ) -> None:
        participant = make_user()
        reservation_id = _reserve(client, online_workshop.id, participant).json()["reservation"]["id"]
        fake_stripe.complete("cs_1")

        res = client.get(f"/api/reservations/{reservation_id}", headers=auth_headers(participant))

        assert res.status_code == 200
        assert res.json()["status"] == "confirmed"
        assert res.json()["payment"]["status"] == "paid"

    def test_still_pending(self, client: TestClient, make_user, online_workshop, fake_stripe: FakeStripe) -> None:
        participant = make_user()
        reservation_id = _reserve(client, online_workshop.id, participant).json()["reservation"]["id"]
        res = client.get(f"/api/reservations/{reservation_id}", headers=auth_headers(participant))
        assert res.json()["status"] == "pending_payment"
        assert res.json()["payment_expires_at"] is not None

    def test_other_users_reservation_is_404(
        self, client: TestClient, make_user, online_workshop, fake_stripe: FakeStripe
    ) -> None:
        reservation_id = _reserve(client, online_workshop.id, make_user()).json()["reservation"]["id"]
        res = client.get(f"/api/reservations/{reservation_id}", headers=auth_headers(make_user()))
        assert res.status_code == 404

    def test_requires_login(self, client: TestClient) -> None:
        assert client.get("/api/reservations/1").status_code == 401

    def test_expired_reservations_are_hidden_from_my_list(
        self, client: TestClient, db: Session, make_user, online_workshop, fake_stripe: FakeStripe
    ) -> None:
        participant = make_user()
        reservation_id = _reserve(client, online_workshop.id, participant).json()["reservation"]["id"]
        db.get(Reservation, reservation_id).status = ReservationStatus.expired
        db.commit()
        assert client.get("/api/reservations/me", headers=auth_headers(participant)).json() == []


class TestAbandonPayment:
    def test_expires_checkout_and_frees_seat(
        self, client: TestClient, db: Session, make_user, online_workshop, fake_stripe: FakeStripe
    ) -> None:
        participant = make_user()
        reservation_id = _reserve(client, online_workshop.id, participant, 3).json()["reservation"]["id"]

        res = client.post(f"/api/reservations/{reservation_id}/abandon-payment", headers=auth_headers(participant))

        assert res.status_code == 200
        assert res.json()["status"] == "expired"
        assert fake_stripe.expired == ["cs_1"]
        assert _reserve(client, online_workshop.id, make_user(), ticket_count=3).status_code == 201

    def test_already_paid_is_reflected_instead(
        self, client: TestClient, db: Session, make_user, online_workshop, fake_stripe: FakeStripe, monkeypatch
    ) -> None:
        participant = make_user()
        reservation_id = _reserve(client, online_workshop.id, participant).json()["reservation"]["id"]
        fake_stripe.complete("cs_1")

        def cannot_expire(*_args: Any, **_kwargs: Any) -> CheckoutSessionState:
            raise StripeUnavailable("already complete")

        monkeypatch.setattr(stripe_client, "expire_checkout_session", cannot_expire)

        res = client.post(f"/api/reservations/{reservation_id}/abandon-payment", headers=auth_headers(participant))

        assert res.status_code == 200
        assert res.json()["status"] == "confirmed"

    def test_while_preparing_checkout_is_409(
        self, client: TestClient, db: Session, make_user, online_workshop, fake_stripe: FakeStripe
    ) -> None:
        """支払い画面を作っている途中に手放すと、作り終えた画面から支払えてしまうので断る"""
        participant = make_user()
        reservation_id = _reserve(client, online_workshop.id, participant).json()["reservation"]["id"]
        _payments(db, reservation_id)[0].stripe_checkout_session_id = None
        db.commit()

        res = client.post(f"/api/reservations/{reservation_id}/abandon-payment", headers=auth_headers(participant))

        assert res.status_code == 409

    def test_confirmed_reservation_is_409(self, client: TestClient, make_user, make_workshop, facilitator) -> None:
        participant = make_user()
        workshop = make_workshop(facilitator)
        reservation_id = _reserve(client, workshop.id, participant).json()["reservation"]["id"]
        res = client.post(f"/api/reservations/{reservation_id}/abandon-payment", headers=auth_headers(participant))
        assert res.status_code == 409

    def test_other_users_reservation_is_404(self, client: TestClient, make_user, online_workshop, fake_stripe) -> None:
        reservation_id = _reserve(client, online_workshop.id, make_user()).json()["reservation"]["id"]
        res = client.post(f"/api/reservations/{reservation_id}/abandon-payment", headers=auth_headers(make_user()))
        assert res.status_code == 404


class TestPaymentMethodOfWorkshop:
    def _create(self, client: TestClient, user: User, **overrides: Any):
        start = utcnow_naive().replace(microsecond=0) + timedelta(days=5)
        payload = {
            "title": "有料のワークショップ",
            "description": "説明",
            "location_type": "offline",
            "location": "東京都",
            "start_at": start.isoformat(),
            "end_at": (start + timedelta(hours=2)).isoformat(),
            "capacity": 5,
            "price": PRICE,
            "payment_method": "online",
            "status": "published",
        }
        payload.update(overrides)
        return client.post("/api/workshops", json=payload, headers=auth_headers(user))

    def test_can_publish_online_with_payout_account(self, client: TestClient, facilitator: User) -> None:
        res = self._create(client, facilitator)
        assert res.status_code == 201
        assert res.json()["payment_method"] == "online"

    def test_cannot_publish_online_without_payout_account(self, client: TestClient, make_user) -> None:
        assert self._create(client, make_user(UserRole.facilitator)).status_code == 409

    def test_draft_can_choose_online_before_payout_setup(self, client: TestClient, make_user) -> None:
        assert self._create(client, make_user(UserRole.facilitator), status="draft").status_code == 201

    def test_free_workshop_becomes_onsite(self, client: TestClient, make_user) -> None:
        res = self._create(client, make_user(UserRole.facilitator), price=0)
        assert res.status_code == 201
        assert res.json()["payment_method"] == "onsite"

    def test_online_price_below_stripe_minimum_is_422(self, client: TestClient, facilitator: User) -> None:
        assert self._create(client, facilitator, price=30).status_code == 422

    def test_published_online_workshop_stays_editable_when_stripe_stops(
        self, client: TestClient, db: Session, facilitator: User, online_workshop: Workshop
    ) -> None:
        """公開後に受け取りが止まっても、説明などの編集はできる(新しく公開するときだけ確かめる)"""
        facilitator.stripe_charges_enabled = False
        db.commit()
        res = client.put(
            f"/api/workshops/{online_workshop.id}",
            json=workshop_payload(online_workshop, description="説明を直しました"),
            headers=auth_headers(facilitator),
        )
        assert res.status_code == 200

    def test_cannot_change_payment_method_after_publishing(
        self, client: TestClient, facilitator: User, make_workshop
    ) -> None:
        workshop = make_workshop(facilitator, price=PRICE)
        res = client.put(
            f"/api/workshops/{workshop.id}",
            json=workshop_payload(workshop, payment_method="online"),
            headers=auth_headers(facilitator),
        )
        assert res.status_code == 409
        assert "支払方法" in res.json()["detail"]
