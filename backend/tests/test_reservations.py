"""予約・予約のキャンセル・出欠"""

from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.timeutil import utcnow_naive
from app.models.notification import Notification, NotificationType
from app.models.reservation import Reservation, ReservationStatus
from app.models.user import UserRole
from app.models.workshop import WorkshopStatus
from tests.conftest import auth_headers


def _reserve(client: TestClient, workshop_id: int, user, ticket_count: int = 1):
    return client.post(
        f"/api/workshops/{workshop_id}/reservations",
        json={"contact": "me@example.com", "ticket_count": ticket_count},
        headers=auth_headers(user),
    )


class TestReserve:
    def test_participant_can_reserve(self, client: TestClient, make_user, make_workshop):
        workshop = make_workshop(make_user(UserRole.facilitator))
        participant = make_user()
        res = _reserve(client, workshop.id, participant, ticket_count=2)
        assert res.status_code == 201
        body = res.json()["reservation"]
        assert body["ticket_count"] == 2
        assert body["workshop"]["reserved_count"] == 2
        assert body["workshop"]["viewer"]["is_reserved"] is True

    def test_cannot_exceed_capacity(self, client: TestClient, make_user, make_workshop):
        workshop = make_workshop(make_user(UserRole.facilitator), capacity=3)
        assert _reserve(client, workshop.id, make_user(), ticket_count=2).status_code == 201
        assert _reserve(client, workshop.id, make_user(), ticket_count=2).status_code == 409
        assert _reserve(client, workshop.id, make_user(), ticket_count=1).status_code == 201

    def test_cannot_reserve_twice(self, client: TestClient, make_user, make_workshop):
        workshop = make_workshop(make_user(UserRole.facilitator))
        participant = make_user()
        assert _reserve(client, workshop.id, participant).status_code == 201
        assert _reserve(client, workshop.id, participant).status_code == 409

    def test_cannot_reserve_own_workshop(self, client: TestClient, make_user, make_workshop):
        owner = make_user(UserRole.facilitator)
        workshop = make_workshop(owner)
        assert _reserve(client, workshop.id, owner).status_code == 409

    def test_cannot_reserve_after_deadline(self, client: TestClient, make_user, make_workshop):
        start_at = utcnow_naive() + timedelta(hours=12)
        workshop = make_workshop(make_user(UserRole.facilitator), start_at=start_at)
        res = _reserve(client, workshop.id, make_user())
        assert res.status_code == 409
        assert "24時間前" in res.json()["detail"]

    def test_draft_cannot_be_reserved(self, client: TestClient, make_user, make_workshop):
        workshop = make_workshop(make_user(UserRole.facilitator), status=WorkshopStatus.draft)
        assert _reserve(client, workshop.id, make_user()).status_code == 404

    def test_cannot_reserve_again_after_canceled_by_facilitator(
        self, client: TestClient, db: Session, make_user, make_workshop
    ):
        workshop = make_workshop(make_user(UserRole.facilitator))
        participant = make_user()
        db.add(
            Reservation(
                workshop_id=workshop.id,
                user_id=participant.id,
                attendee_name="x",
                contact="a@example.com",
                ticket_count=1,
                status=ReservationStatus.canceled,
            )
        )
        db.commit()
        assert _reserve(client, workshop.id, participant).status_code == 409

    def test_my_reservations(self, client: TestClient, make_user, make_workshop):
        workshop = make_workshop(make_user(UserRole.facilitator))
        participant = make_user()
        _reserve(client, workshop.id, participant)
        res = client.get("/api/reservations/me", headers=auth_headers(participant))
        assert res.status_code == 200
        assert [r["workshop_id"] for r in res.json()] == [workshop.id]


class TestCancelReservation:
    def test_owner_cancels_and_participant_is_notified(
        self, client: TestClient, db: Session, make_user, make_workshop
    ):
        owner = make_user(UserRole.facilitator)
        workshop = make_workshop(owner)
        participant = make_user()
        reservation_id = _reserve(client, workshop.id, participant).json()["reservation"]["id"]

        res = client.post(
            f"/api/workshops/{workshop.id}/reservations/{reservation_id}/cancel", json={"reason": "facilitator"}, headers=auth_headers(owner)
        )
        assert res.status_code == 200
        assert res.json()["status"] == "canceled"
        notification = db.scalar(select(Notification).where(Notification.user_id == participant.id))
        assert notification is not None
        assert notification.type == NotificationType.reservation_canceled

        # 2回目は既にキャンセル済み
        again = client.post(
            f"/api/workshops/{workshop.id}/reservations/{reservation_id}/cancel", json={"reason": "facilitator"}, headers=auth_headers(owner)
        )
        assert again.status_code == 409

    def test_other_facilitator_cannot_cancel(self, client: TestClient, make_user, make_workshop):
        workshop = make_workshop(make_user(UserRole.facilitator))
        reservation_id = _reserve(client, workshop.id, make_user()).json()["reservation"]["id"]
        other = make_user(UserRole.facilitator)
        res = client.post(
            f"/api/workshops/{workshop.id}/reservations/{reservation_id}/cancel", json={"reason": "facilitator"}, headers=auth_headers(other)
        )
        assert res.status_code == 403

    def test_reservation_of_another_workshop_is_404(self, client: TestClient, make_user, make_workshop):
        owner = make_user(UserRole.facilitator)
        workshop = make_workshop(owner)
        another = make_workshop(make_user(UserRole.facilitator))
        reservation_id = _reserve(client, another.id, make_user()).json()["reservation"]["id"]
        res = client.post(
            f"/api/workshops/{workshop.id}/reservations/{reservation_id}/cancel", json={"reason": "facilitator"}, headers=auth_headers(owner)
        )
        assert res.status_code == 404


class TestAttendance:
    def _setup(self, client, db, make_user, make_workshop, start_in: timedelta):
        owner = make_user(UserRole.facilitator)
        workshop = make_workshop(owner)
        reservation_id = _reserve(client, workshop.id, make_user()).json()["reservation"]["id"]
        # 予約の締め切り後の日時に動かす
        workshop.start_at = utcnow_naive() + start_in
        workshop.end_at = workshop.start_at + timedelta(hours=2)
        db.commit()
        return owner, workshop, reservation_id

    def test_can_record_within_24_hours(self, client: TestClient, db: Session, make_user, make_workshop):
        owner, workshop, reservation_id = self._setup(client, db, make_user, make_workshop, timedelta(hours=1))
        res = client.put(
            f"/api/workshops/{workshop.id}/reservations/{reservation_id}/attendance",
            json={"attendance": "present"},
            headers=auth_headers(owner),
        )
        assert res.status_code == 200
        assert res.json()["attendance"] == "present"

    def test_cannot_record_too_early(self, client: TestClient, db: Session, make_user, make_workshop):
        owner, workshop, reservation_id = self._setup(client, db, make_user, make_workshop, timedelta(days=3))
        res = client.put(
            f"/api/workshops/{workshop.id}/reservations/{reservation_id}/attendance",
            json={"attendance": "present"},
            headers=auth_headers(owner),
        )
        assert res.status_code == 409

    def test_missing_reservation_is_404(self, client: TestClient, db: Session, make_user, make_workshop):
        owner, workshop, _ = self._setup(client, db, make_user, make_workshop, timedelta(hours=1))
        res = client.put(
            f"/api/workshops/{workshop.id}/reservations/9999/attendance",
            json={"attendance": "present"},
            headers=auth_headers(owner),
        )
        assert res.status_code == 404
