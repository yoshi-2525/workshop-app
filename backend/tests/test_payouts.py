"""主催者の売上と振込: 残高の計算・収入の明細・振込先口座・振込の申請と、運営による振込の処理。

参加費は運営の Stripe アカウントで受け取り、主催者の受取額(参加費の 90%)を支払いごとに記録している
"""

from collections.abc import Callable
from datetime import timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, settings
from app.core.timeutil import utcnow_naive
from app.models.payment import Payment, PaymentStatus
from app.models.payout import PayoutRequest, PayoutRequestStatus
from app.models.reservation import Reservation, ReservationStatus
from app.models.user import User, UserRole
from app.models.workshop import PaymentMethod, Workshop, WorkshopStatus
from tests.conftest import auth_headers

BASE = "/api/facilitators/me/payouts"
ADMIN = "/api/admin/payout-requests"
PRICE = 3000
FACILITATOR_AMOUNT = 2700

BANK_ACCOUNT = {
    "bank_name": "みずほ銀行",
    "bank_code": "0001",
    "branch_name": "東京営業部",
    "branch_code": "001",
    "account_type": "ordinary",
    "account_number": "1234567",
    "account_holder": "ヤマダ タロウ",
}


@pytest.fixture(autouse=True)
def _payout_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_dummy")
    monkeypatch.setattr(settings, "payout_min_amount", 1000)
    monkeypatch.setattr(settings, "payout_transfer_fee", 250)


@pytest.fixture
def facilitator(make_user: Callable[..., User]) -> User:
    return make_user(UserRole.facilitator)


@pytest.fixture
def admin(make_user: Callable[..., User]) -> User:
    return make_user(UserRole.admin)


@pytest.fixture
def ended_workshop(make_workshop: Callable[..., Workshop], facilitator: User) -> Workshop:
    """開催を終えたオンライン決済のワークショップ"""
    return make_workshop(
        facilitator,
        price=PRICE,
        payment_method=PaymentMethod.online,
        start_at=utcnow_naive().replace(microsecond=0) - timedelta(days=2),
    )


@pytest.fixture
def upcoming_workshop(make_workshop: Callable[..., Workshop], facilitator: User) -> Workshop:
    return make_workshop(facilitator, price=PRICE, payment_method=PaymentMethod.online)


@pytest.fixture
def add_paid(db: Session, make_user: Callable[..., User]) -> Callable[..., Payment]:
    """ワークショップに、支払い済みの予約を1件加える"""

    def _add(workshop: Workshop, *, status: PaymentStatus = PaymentStatus.paid, tickets: int = 1) -> Payment:
        reservation = Reservation(
            workshop_id=workshop.id,
            user_id=make_user().id,
            contact="p@example.com",
            ticket_count=tickets,
            status=ReservationStatus.confirmed if status == PaymentStatus.paid else ReservationStatus.canceled,
        )
        db.add(reservation)
        db.flush()
        amount = PRICE * tickets
        payment = Payment(
            reservation_id=reservation.id,
            stripe_checkout_session_id=f"cs_{reservation.id}",
            stripe_payment_intent_id=f"pi_{reservation.id}",
            amount=amount,
            platform_fee_amount=amount // 10,
            facilitator_amount=amount - amount // 10,
            stripe_fee_amount=108,
            status=status,
            paid_at=utcnow_naive(),
        )
        db.add(payment)
        db.commit()
        return payment

    return _add


def _summary(client: TestClient, user: User) -> dict[str, Any]:
    res = client.get(f"{BASE}/summary", headers=auth_headers(user))
    assert res.status_code == 200
    return res.json()


def _register_bank(client: TestClient, user: User, **overrides: Any):
    return client.put(f"{BASE}/bank-account", json={**BANK_ACCOUNT, **overrides}, headers=auth_headers(user))


def _request(client: TestClient, user: User):
    return client.post(f"{BASE}/requests", headers=auth_headers(user))


class TestBalance:
    def test_empty(self, client: TestClient, facilitator: User) -> None:
        body = _summary(client, facilitator)
        assert body["available_amount"] == 0
        assert body["upcoming_amount"] == 0
        assert body["min_amount"] == 1000 and body["transfer_fee"] == 250
        assert body["can_request"] is False

    def test_ended_workshop_is_available_and_upcoming_is_not(
        self, client: TestClient, facilitator: User, ended_workshop, upcoming_workshop, add_paid
    ) -> None:
        add_paid(ended_workshop, tickets=2)
        add_paid(upcoming_workshop)

        body = _summary(client, facilitator)
        # 参加費の 90% が主催者の受取額
        assert body["available_amount"] == FACILITATOR_AMOUNT * 2
        # 開催前は取消・中止で返金になりうるので、まだ申請できない
        assert body["upcoming_amount"] == FACILITATOR_AMOUNT

    def test_refunded_payments_are_not_counted(
        self, client: TestClient, facilitator: User, ended_workshop, add_paid
    ) -> None:
        add_paid(ended_workshop, status=PaymentStatus.refunded)
        add_paid(ended_workshop, status=PaymentStatus.refund_pending)
        add_paid(ended_workshop, status=PaymentStatus.refund_failed)
        assert _summary(client, facilitator)["available_amount"] == 0

    def test_canceled_workshop_is_not_counted(
        self, client: TestClient, db: Session, facilitator: User, ended_workshop, add_paid
    ) -> None:
        add_paid(ended_workshop)
        ended_workshop.status = WorkshopStatus.canceled
        db.commit()
        assert _summary(client, facilitator)["available_amount"] == 0

    def test_other_facilitators_earnings_are_not_counted(
        self, client: TestClient, make_user, make_workshop, add_paid, facilitator: User
    ) -> None:
        other = make_user(UserRole.facilitator)
        workshop = make_workshop(
            other, price=PRICE, payment_method=PaymentMethod.online, start_at=utcnow_naive() - timedelta(days=2)
        )
        add_paid(workshop)
        assert _summary(client, facilitator)["available_amount"] == 0
        assert _summary(client, other)["available_amount"] == FACILITATOR_AMOUNT

    def test_workshop_ending_now_is_not_settled_yet(
        self, client: TestClient, db: Session, facilitator: User, ended_workshop, add_paid, monkeypatch
    ) -> None:
        """終了日時ちょうどはまだ中止できるので、申請できる額に入れない"""
        add_paid(ended_workshop)
        from app.services import payouts

        monkeypatch.setattr(payouts, "utcnow_naive", lambda: ended_workshop.end_at)
        body = _summary(client, facilitator)
        assert body["available_amount"] == 0 and body["upcoming_amount"] == FACILITATOR_AMOUNT

    def test_participant_is_forbidden(self, client: TestClient, make_user) -> None:
        assert client.get(f"{BASE}/summary", headers=auth_headers(make_user())).status_code == 403

    def test_requires_login(self, client: TestClient) -> None:
        assert client.get(f"{BASE}/summary").status_code == 401


class TestEarnings:
    def test_lists_paid_and_refunded_payments(
        self, client: TestClient, facilitator: User, ended_workshop, upcoming_workshop, add_paid
    ) -> None:
        settled = add_paid(ended_workshop)
        refunded = add_paid(ended_workshop, status=PaymentStatus.refunded)
        upcoming = add_paid(upcoming_workshop)

        res = client.get(f"{BASE}/earnings", headers=auth_headers(facilitator))

        assert res.status_code == 200
        rows = {row["payment_id"]: row for row in res.json()}
        assert rows[settled.id]["facilitator_amount"] == FACILITATOR_AMOUNT and rows[settled.id]["settled"] is True
        # 返金になったものは受取 0
        assert rows[refunded.id]["facilitator_amount"] == 0 and rows[refunded.id]["settled"] is False
        assert rows[upcoming.id]["facilitator_amount"] == FACILITATOR_AMOUNT
        assert rows[upcoming.id]["settled"] is False
        # 終了日時の新しい順
        assert res.json()[0]["payment_id"] == upcoming.id

    def test_unpaid_payments_and_other_facilitators_are_excluded(
        self, client: TestClient, db: Session, make_user, facilitator: User, ended_workshop, add_paid
    ) -> None:
        pending = add_paid(ended_workshop)
        pending.status = PaymentStatus.expired
        pending.paid_at = None
        db.commit()
        assert client.get(f"{BASE}/earnings", headers=auth_headers(facilitator)).json() == []
        other = make_user(UserRole.facilitator)
        add_paid(ended_workshop)
        assert client.get(f"{BASE}/earnings", headers=auth_headers(other)).json() == []

    def test_pagination(self, client: TestClient, facilitator: User, ended_workshop, add_paid) -> None:
        for _ in range(3):
            add_paid(ended_workshop)
        res = client.get(f"{BASE}/earnings?limit=2", headers=auth_headers(facilitator))
        assert len(res.json()) == 2 and res.headers["X-Total-Count"] == "3"


class TestBankAccount:
    def test_not_registered_is_null(self, client: TestClient, facilitator: User) -> None:
        res = client.get(f"{BASE}/bank-account", headers=auth_headers(facilitator))
        assert res.status_code == 200 and res.json() is None

    def test_register_and_update(self, client: TestClient, facilitator: User) -> None:
        assert _register_bank(client, facilitator).status_code == 200
        res = _register_bank(client, facilitator, account_number="7654321", account_type="checking")
        assert res.status_code == 200
        got = client.get(f"{BASE}/bank-account", headers=auth_headers(facilitator)).json()
        assert got["account_number"] == "7654321" and got["account_type"] == "checking"
        assert got["bank_name"] == "みずほ銀行"

    @pytest.mark.parametrize(
        "field,value",
        [
            ("bank_code", "001"),
            ("bank_code", "00a1"),
            ("branch_code", "0001"),
            ("account_number", "123456"),
            ("account_holder", "yamada taro"),
            ("account_holder", "山田太郎"),
            ("account_holder", "ー()"),
            ("bank_name", "  "),
            ("account_type", "savings"),
        ],
    )
    def test_invalid_input_is_422(self, client: TestClient, facilitator: User, field: str, value: str) -> None:
        assert _register_bank(client, facilitator, **{field: value}).status_code == 422

    def test_participant_is_forbidden(self, client: TestClient, make_user) -> None:
        assert _register_bank(client, make_user()).status_code == 403


class TestPayoutRequest:
    def test_requests_full_available_amount(
        self, client: TestClient, db: Session, facilitator: User, ended_workshop, add_paid
    ) -> None:
        add_paid(ended_workshop)
        _register_bank(client, facilitator)

        res = _request(client, facilitator)

        assert res.status_code == 201
        body = res.json()
        assert body["amount"] == FACILITATOR_AMOUNT
        assert body["transfer_fee"] == 250
        assert body["transfer_amount"] == FACILITATOR_AMOUNT - 250
        assert body["status"] == "requested"
        assert body["bank_account"]["account_number"] == "1234567"
        summary = _summary(client, facilitator)
        assert summary["available_amount"] == 0
        assert summary["requested_amount"] == FACILITATOR_AMOUNT
        assert summary["can_request"] is False

    def test_bank_account_is_copied_at_request_time(
        self, client: TestClient, facilitator: User, ended_workshop, add_paid
    ) -> None:
        add_paid(ended_workshop)
        _register_bank(client, facilitator)
        _request(client, facilitator)
        _register_bank(client, facilitator, account_number="7654321")

        history = client.get(f"{BASE}/requests", headers=auth_headers(facilitator)).json()
        assert history[0]["bank_account"]["account_number"] == "1234567"

    def test_without_bank_account_is_409(
        self, client: TestClient, facilitator: User, ended_workshop, add_paid
    ) -> None:
        add_paid(ended_workshop)
        res = _request(client, facilitator)
        assert res.status_code == 409 and "口座" in res.json()["detail"]

    def test_below_minimum_is_409(
        self, client: TestClient, facilitator: User, ended_workshop, add_paid, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(settings, "payout_min_amount", FACILITATOR_AMOUNT + 1)
        add_paid(ended_workshop)
        _register_bank(client, facilitator)
        assert _request(client, facilitator).status_code == 409
        assert _summary(client, facilitator)["can_request"] is False

    def test_upcoming_earnings_cannot_be_requested(
        self, client: TestClient, facilitator: User, upcoming_workshop, add_paid
    ) -> None:
        add_paid(upcoming_workshop)
        _register_bank(client, facilitator)
        assert _request(client, facilitator).status_code == 409

    def test_second_request_while_open_is_409(
        self, client: TestClient, facilitator: User, ended_workshop, add_paid
    ) -> None:
        add_paid(ended_workshop)
        _register_bank(client, facilitator)
        _request(client, facilitator)
        add_paid(ended_workshop)
        res = _request(client, facilitator)
        assert res.status_code == 409 and "申請中" in res.json()["detail"]

    def test_history_shows_only_own_requests(
        self, client: TestClient, db: Session, make_user, facilitator: User, ended_workshop, add_paid
    ) -> None:
        add_paid(ended_workshop)
        _register_bank(client, facilitator)
        _request(client, facilitator)
        other = make_user(UserRole.facilitator)
        assert client.get(f"{BASE}/requests", headers=auth_headers(other)).json() == []
        assert len(client.get(f"{BASE}/requests", headers=auth_headers(facilitator)).json()) == 1

    def test_participant_is_forbidden(self, client: TestClient, make_user) -> None:
        assert _request(client, make_user()).status_code == 403

    def test_requires_login(self, client: TestClient) -> None:
        assert client.post(f"{BASE}/requests").status_code == 401


class TestAdminProcessing:
    @pytest.fixture
    def open_request(self, client: TestClient, facilitator: User, ended_workshop, add_paid) -> dict[str, Any]:
        add_paid(ended_workshop)
        _register_bank(client, facilitator)
        return _request(client, facilitator).json()

    def test_lists_requests_with_facilitator(
        self, client: TestClient, admin: User, facilitator: User, open_request
    ) -> None:
        res = client.get(f"{ADMIN}?status=requested", headers=auth_headers(admin))
        assert res.status_code == 200
        [row] = res.json()
        assert row["id"] == open_request["id"]
        assert row["facilitator_name"] == facilitator.name
        assert row["facilitator_email"] == facilitator.email
        assert client.get(f"{ADMIN}?status=paid", headers=auth_headers(admin)).json() == []

    def test_mark_paid(self, client: TestClient, db: Session, admin: User, facilitator: User, open_request) -> None:
        res = client.post(
            f"{ADMIN}/{open_request['id']}/paid", json={"note": "10/6 振込"}, headers=auth_headers(admin)
        )

        assert res.status_code == 200
        assert res.json()["status"] == "paid" and res.json()["processed_at"] is not None
        summary = _summary(client, facilitator)
        assert summary["paid_amount"] == FACILITATOR_AMOUNT
        assert summary["requested_amount"] == 0
        assert summary["available_amount"] == 0
        history = client.get(f"{BASE}/requests", headers=auth_headers(facilitator)).json()
        assert history[0]["note"] == "10/6 振込"

    def test_reject_returns_amount_to_balance(
        self, client: TestClient, admin: User, facilitator: User, open_request
    ) -> None:
        res = client.post(f"{ADMIN}/{open_request['id']}/reject", json={"note": "口座名義の誤り"}, headers=auth_headers(admin))

        assert res.status_code == 200 and res.json()["status"] == "rejected"
        summary = _summary(client, facilitator)
        assert summary["available_amount"] == FACILITATOR_AMOUNT
        assert summary["can_request"] is True

    def test_processed_request_cannot_be_processed_again(
        self, client: TestClient, admin: User, open_request
    ) -> None:
        client.post(f"{ADMIN}/{open_request['id']}/paid", json={}, headers=auth_headers(admin))
        assert client.post(f"{ADMIN}/{open_request['id']}/paid", json={}, headers=auth_headers(admin)).status_code == 409
        res = client.post(f"{ADMIN}/{open_request['id']}/reject", json={"note": "理由"}, headers=auth_headers(admin))
        assert res.status_code == 409

    def test_reject_requires_reason(self, client: TestClient, admin: User, open_request) -> None:
        res = client.post(f"{ADMIN}/{open_request['id']}/reject", json={"note": "  "}, headers=auth_headers(admin))
        assert res.status_code == 422

    def test_unknown_request_is_404(self, client: TestClient, admin: User) -> None:
        assert client.post(f"{ADMIN}/999/paid", json={}, headers=auth_headers(admin)).status_code == 404

    def test_facilitator_cannot_use_admin_api(
        self, client: TestClient, db: Session, facilitator: User, open_request
    ) -> None:
        assert client.get(ADMIN, headers=auth_headers(facilitator)).status_code == 403
        res = client.post(f"{ADMIN}/{open_request['id']}/paid", json={}, headers=auth_headers(facilitator))
        assert res.status_code == 403
        db.expire_all()
        assert db.scalar(select(PayoutRequest)).status == PayoutRequestStatus.requested

    def test_requires_login(self, client: TestClient) -> None:
        assert client.get(ADMIN).status_code == 401


class TestSettings:
    def test_production_requires_https_frontend(self) -> None:
        config = Settings(
            app_env="production", stripe_secret_key="sk_live_dummy", frontend_base_url="http://example.com"
        )
        with pytest.raises(RuntimeError):
            config.check_stripe_settings()

    def test_trailing_slash_is_removed(self) -> None:
        assert Settings(frontend_base_url="https://example.com/").frontend_base_url == "https://example.com"

    def test_transfer_fee_must_be_below_minimum(self) -> None:
        # オンライン決済の鍵がなくても確かめる(過去の売上の振込は申請できるため)
        config = Settings(stripe_secret_key="", payout_min_amount=200, payout_transfer_fee=250)
        with pytest.raises(RuntimeError):
            config.check_payout_settings()
