"""ワークショップの中止・通知"""

from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.timeutil import utcnow_naive
from app.models.reservation import Reservation
from app.models.user import UserRole
from app.models.workshop import WorkshopStatus
from tests.conftest import auth_headers, workshop_payload


def _add_reservation(db: Session, workshop, user) -> None:
    db.add(
        Reservation(workshop_id=workshop.id, user_id=user.id, contact="a@example.com", ticket_count=1)
    )
    db.commit()


class TestCancelWorkshop:
    def test_cancel_notifies_participants(self, client: TestClient, db: Session, make_user, make_workshop):
        owner = make_user(UserRole.facilitator)
        workshop = make_workshop(owner)
        participant = make_user()
        _add_reservation(db, workshop, participant)

        res = client.post(f"/api/workshops/{workshop.id}/cancel", headers=auth_headers(owner))
        assert res.status_code == 200
        assert res.json()["status"] == "canceled"

        notifications = client.get("/api/notifications", headers=auth_headers(participant)).json()
        assert [n["type"] for n in notifications] == ["cancellation"]

        # 中止は取り消せず、もう一度中止にもできない
        assert client.post(f"/api/workshops/{workshop.id}/cancel", headers=auth_headers(owner)).status_code == 409

    def test_draft_cannot_be_canceled(self, client: TestClient, make_user, make_workshop):
        owner = make_user(UserRole.facilitator)
        workshop = make_workshop(owner, status=WorkshopStatus.draft)
        assert client.post(f"/api/workshops/{workshop.id}/cancel", headers=auth_headers(owner)).status_code == 409

    def test_finished_cannot_be_canceled(self, client: TestClient, make_user, make_workshop):
        owner = make_user(UserRole.facilitator)
        start_at = utcnow_naive() - timedelta(days=2)
        workshop = make_workshop(owner, start_at=start_at, end_at=start_at + timedelta(hours=2))
        assert client.post(f"/api/workshops/{workshop.id}/cancel", headers=auth_headers(owner)).status_code == 409

    def test_other_facilitator_cannot_cancel(self, client: TestClient, make_user, make_workshop):
        workshop = make_workshop(make_user(UserRole.facilitator))
        other = make_user(UserRole.facilitator)
        assert client.post(f"/api/workshops/{workshop.id}/cancel", headers=auth_headers(other)).status_code == 403

    def test_update_cannot_cancel(self, client: TestClient, make_user, make_workshop):
        # 中止は通知を伴う専用の操作で行い、内容の更新では受け付けない
        owner = make_user(UserRole.facilitator)
        workshop = make_workshop(owner)
        res = client.put(
            f"/api/workshops/{workshop.id}", json=workshop_payload(workshop, status="canceled"), headers=auth_headers(owner)
        )
        assert res.status_code == 409


class TestNotifications:
    def test_unread_count_and_mark_read(self, client: TestClient, db: Session, make_user, make_workshop):
        owner = make_user(UserRole.facilitator)
        participant = make_user()
        for _ in range(2):
            workshop = make_workshop(owner)
            _add_reservation(db, workshop, participant)
            client.post(f"/api/workshops/{workshop.id}/cancel", headers=auth_headers(owner))

        headers = auth_headers(participant)
        assert client.get("/api/notifications/unread-count", headers=headers).json() == {"count": 2}

        first_id = client.get("/api/notifications", headers=headers).json()[0]["id"]
        read = client.post(f"/api/notifications/{first_id}/read", headers=headers)
        assert read.json()["is_read"] is True
        assert client.get("/api/notifications/unread-count", headers=headers).json() == {"count": 1}

        assert client.post("/api/notifications/read-all", headers=headers).status_code == 204
        assert client.get("/api/notifications/unread-count", headers=headers).json() == {"count": 0}

    def test_cannot_read_others_notification(self, client: TestClient, db: Session, make_user, make_workshop):
        owner = make_user(UserRole.facilitator)
        participant = make_user()
        workshop = make_workshop(owner)
        _add_reservation(db, workshop, participant)
        client.post(f"/api/workshops/{workshop.id}/cancel", headers=auth_headers(owner))
        notification_id = client.get("/api/notifications", headers=auth_headers(participant)).json()[0]["id"]

        res = client.post(f"/api/notifications/{notification_id}/read", headers=auth_headers(make_user()))
        assert res.status_code == 404


def test_register_rejects_invalid_email_in_japanese(client: TestClient):
    res = client.post("/api/auth/register", json={"name": "a", "email": "not-an-email", "password": "password123"})
    assert res.status_code == 422
    assert res.json()["detail"][0]["msg"] == "メールアドレスの形式が正しくありません"
