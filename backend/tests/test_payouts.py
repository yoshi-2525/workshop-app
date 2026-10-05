"""主催者の参加費の受け取り設定(Stripe の連結アカウント)の API。

Stripe は呼ばず、app.core.stripe_client の関数を差し替えて確かめる
"""

from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import Settings, settings
from app.core import stripe_client
from app.core.stripe_client import AccountState, StripeUnavailable
from app.models.user import User, UserRole
from tests.conftest import auth_headers

URL = "/api/facilitators/me/payout-account"


@pytest.fixture(autouse=True)
def _stripe_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_dummy")
    monkeypatch.setattr(settings, "frontend_base_url", "http://front.example")


@pytest.fixture
def fake_stripe(monkeypatch: pytest.MonkeyPatch) -> dict[str, list[Any]]:
    """呼び出しを記録し、決まった値を返す Stripe の代わり"""
    calls: dict[str, list[Any]] = {"create": [], "retrieve": [], "link": [], "login": []}
    state = {"charges_enabled": False}

    def create_express_account(*, user_id: int, email: str) -> AccountState:
        calls["create"].append((user_id, email))
        return AccountState(account_id=f"acct_{user_id}", charges_enabled=False, details_submitted=False)

    def retrieve_account(account_id: str) -> AccountState:
        calls["retrieve"].append(account_id)
        return AccountState(account_id=account_id, charges_enabled=state["charges_enabled"], details_submitted=True)

    def create_account_link(account_id: str, *, refresh_url: str, return_url: str) -> str:
        calls["link"].append((account_id, refresh_url, return_url))
        return f"https://connect.stripe.test/setup/{account_id}"

    def create_login_link(account_id: str) -> str:
        calls["login"].append(account_id)
        return f"https://connect.stripe.test/express/{account_id}"

    monkeypatch.setattr(stripe_client, "create_express_account", create_express_account)
    monkeypatch.setattr(stripe_client, "retrieve_account", retrieve_account)
    monkeypatch.setattr(stripe_client, "create_account_link", create_account_link)
    monkeypatch.setattr(stripe_client, "create_login_link", create_login_link)
    calls["state"] = [state]
    return calls


def _register_account(db: Session, user: User, *, enabled: bool) -> None:
    user.stripe_account_id = f"acct_{user.id}"
    user.stripe_charges_enabled = enabled
    db.commit()


class TestPayoutStatus:
    def test_not_registered(self, client: TestClient, make_user: Callable[..., User], fake_stripe) -> None:
        facilitator = make_user(UserRole.facilitator)
        res = client.get(URL, headers=auth_headers(facilitator))
        assert res.status_code == 200
        assert res.json() == {"status": "not_registered", "online_payment_available": True}
        assert fake_stripe["retrieve"] == []

    def test_pending_account_is_synced_from_stripe(
        self, client: TestClient, db: Session, make_user: Callable[..., User], fake_stripe
    ) -> None:
        facilitator = make_user(UserRole.facilitator)
        _register_account(db, facilitator, enabled=False)
        fake_stripe["state"][0]["charges_enabled"] = True

        res = client.get(URL, headers=auth_headers(facilitator))

        assert res.json()["status"] == "enabled"
        assert fake_stripe["retrieve"] == [f"acct_{facilitator.id}"]
        db.refresh(facilitator)
        assert facilitator.stripe_charges_enabled is True

    def test_enabled_account_is_not_refetched(
        self, client: TestClient, db: Session, make_user: Callable[..., User], fake_stripe
    ) -> None:
        facilitator = make_user(UserRole.facilitator)
        _register_account(db, facilitator, enabled=True)
        res = client.get(URL, headers=auth_headers(facilitator))
        assert res.json()["status"] == "enabled"
        assert fake_stripe["retrieve"] == []

    def test_online_payment_unavailable_when_key_missing(
        self, client: TestClient, make_user: Callable[..., User], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(settings, "stripe_secret_key", "")
        facilitator = make_user(UserRole.facilitator)
        res = client.get(URL, headers=auth_headers(facilitator))
        assert res.json() == {"status": "not_registered", "online_payment_available": False}

    def test_stripe_failure_falls_back_to_saved_status(
        self,
        client: TestClient,
        db: Session,
        make_user: Callable[..., User],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        def fail(_account_id: str) -> AccountState:
            raise StripeUnavailable("down")

        monkeypatch.setattr(stripe_client, "retrieve_account", fail)
        facilitator = make_user(UserRole.facilitator)
        _register_account(db, facilitator, enabled=False)

        res = client.get(URL, headers=auth_headers(facilitator))

        assert res.status_code == 200
        assert res.json()["status"] == "pending"

    def test_admin_can_use(self, client: TestClient, make_user: Callable[..., User], fake_stripe) -> None:
        admin = make_user(UserRole.admin)
        assert client.get(URL, headers=auth_headers(admin)).status_code == 200

    def test_participant_is_forbidden(self, client: TestClient, make_user: Callable[..., User]) -> None:
        participant = make_user(UserRole.participant)
        assert client.get(URL, headers=auth_headers(participant)).status_code == 403

    def test_requires_login(self, client: TestClient) -> None:
        assert client.get(URL).status_code == 401


class TestOnboarding:
    def test_creates_account_and_returns_link(
        self, client: TestClient, db: Session, make_user: Callable[..., User], fake_stripe
    ) -> None:
        facilitator = make_user(UserRole.facilitator)

        res = client.post(f"{URL}/onboarding", headers=auth_headers(facilitator))

        assert res.status_code == 200
        assert res.json() == {"url": f"https://connect.stripe.test/setup/acct_{facilitator.id}"}
        assert fake_stripe["create"] == [(facilitator.id, facilitator.email)]
        assert fake_stripe["link"] == [
            (
                f"acct_{facilitator.id}",
                "http://front.example/manage/payout?refresh=1",
                "http://front.example/manage/payout?returned=1",
            )
        ]
        db.refresh(facilitator)
        assert facilitator.stripe_account_id == f"acct_{facilitator.id}"

    def test_reuses_existing_account(
        self, client: TestClient, db: Session, make_user: Callable[..., User], fake_stripe
    ) -> None:
        facilitator = make_user(UserRole.facilitator)
        _register_account(db, facilitator, enabled=False)

        res = client.post(f"{URL}/onboarding", headers=auth_headers(facilitator))

        assert res.status_code == 200
        assert fake_stripe["create"] == []

    def test_stripe_failure_is_503_and_saves_nothing(
        self,
        client: TestClient,
        db: Session,
        make_user: Callable[..., User],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        def fail(**_kwargs: Any) -> AccountState:
            raise StripeUnavailable("down")

        monkeypatch.setattr(stripe_client, "create_express_account", fail)
        facilitator = make_user(UserRole.facilitator)

        res = client.post(f"{URL}/onboarding", headers=auth_headers(facilitator))

        assert res.status_code == 503
        db.refresh(facilitator)
        assert facilitator.stripe_account_id is None

    def test_account_is_kept_when_link_creation_fails(
        self,
        client: TestClient,
        db: Session,
        make_user: Callable[..., User],
        fake_stripe,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """アカウントを作った後に URL の作成で失敗しても、作ったアカウントは保存され、再試行で作り直さない"""

        def fail(_account_id: str, **_kwargs: Any) -> str:
            raise StripeUnavailable("down")

        monkeypatch.setattr(stripe_client, "create_account_link", fail)
        facilitator = make_user(UserRole.facilitator)

        res = client.post(f"{URL}/onboarding", headers=auth_headers(facilitator))

        assert res.status_code == 503
        db.refresh(facilitator)
        assert facilitator.stripe_account_id == f"acct_{facilitator.id}"

        monkeypatch.undo()
        monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_dummy")
        monkeypatch.setattr(stripe_client, "create_express_account", lambda **_: pytest.fail("作り直さない"))
        monkeypatch.setattr(stripe_client, "create_account_link", lambda account_id, **_: f"https://x/{account_id}")
        retry = client.post(f"{URL}/onboarding", headers=auth_headers(facilitator))
        assert retry.status_code == 200
        assert retry.json() == {"url": f"https://x/acct_{facilitator.id}"}

    def test_disabled_online_payment_is_409(
        self, client: TestClient, make_user: Callable[..., User], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(settings, "stripe_secret_key", "")
        facilitator = make_user(UserRole.facilitator)
        assert client.post(f"{URL}/onboarding", headers=auth_headers(facilitator)).status_code == 409

    def test_participant_is_forbidden(self, client: TestClient, make_user: Callable[..., User]) -> None:
        participant = make_user(UserRole.participant)
        assert client.post(f"{URL}/onboarding", headers=auth_headers(participant)).status_code == 403

    def test_requires_login(self, client: TestClient) -> None:
        assert client.post(f"{URL}/onboarding").status_code == 401


class TestDashboard:
    def test_returns_login_link_when_enabled(
        self, client: TestClient, db: Session, make_user: Callable[..., User], fake_stripe
    ) -> None:
        facilitator = make_user(UserRole.facilitator)
        _register_account(db, facilitator, enabled=True)

        res = client.post(f"{URL}/dashboard", headers=auth_headers(facilitator))

        assert res.status_code == 200
        assert res.json() == {"url": f"https://connect.stripe.test/express/acct_{facilitator.id}"}

    def test_pending_account_is_409(
        self, client: TestClient, db: Session, make_user: Callable[..., User], fake_stripe
    ) -> None:
        facilitator = make_user(UserRole.facilitator)
        _register_account(db, facilitator, enabled=False)
        assert client.post(f"{URL}/dashboard", headers=auth_headers(facilitator)).status_code == 409
        assert fake_stripe["login"] == []

    def test_not_registered_is_409(self, client: TestClient, make_user: Callable[..., User], fake_stripe) -> None:
        facilitator = make_user(UserRole.facilitator)
        assert client.post(f"{URL}/dashboard", headers=auth_headers(facilitator)).status_code == 409

    def test_participant_is_forbidden(self, client: TestClient, make_user: Callable[..., User]) -> None:
        participant = make_user(UserRole.participant)
        assert client.post(f"{URL}/dashboard", headers=auth_headers(participant)).status_code == 403

    def test_requires_login(self, client: TestClient) -> None:
        assert client.post(f"{URL}/dashboard").status_code == 401


class TestStripeSettings:
    def test_production_requires_https_frontend(self) -> None:
        config = Settings(
            app_env="production", stripe_secret_key="sk_live_dummy", frontend_base_url="http://example.com"
        )
        with pytest.raises(RuntimeError):
            config.check_stripe_settings()

    def test_trailing_slash_is_removed(self) -> None:
        assert Settings(frontend_base_url="https://example.com/").frontend_base_url == "https://example.com"
