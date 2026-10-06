"""ワークショップの閲覧・編集・削除の権限"""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.reservation import Reservation, ReservationStatus
from app.models.user import UserRole
from app.models.workshop import WorkshopStatus
from tests.conftest import auth_headers, workshop_payload


class TestViewWorkshop:
    def test_published_is_visible_to_anyone(self, client: TestClient, make_user, make_workshop):
        workshop = make_workshop(make_user(UserRole.facilitator))
        res = client.get(f"/api/workshops/{workshop.id}")
        assert res.status_code == 200
        assert res.json()["title"] == workshop.title

    def test_missing_is_404(self, client: TestClient):
        assert client.get("/api/workshops/9999").status_code == 404

    def test_draft_is_hidden_from_others(self, client: TestClient, make_user, make_workshop):
        workshop = make_workshop(make_user(UserRole.facilitator), status=WorkshopStatus.draft)
        other = make_user(UserRole.facilitator)
        assert client.get(f"/api/workshops/{workshop.id}").status_code == 404
        assert client.get(f"/api/workshops/{workshop.id}", headers=auth_headers(other)).status_code == 404

    def test_draft_is_visible_to_owner_and_admin(self, client: TestClient, make_user, make_workshop):
        owner = make_user(UserRole.facilitator)
        workshop = make_workshop(owner, status=WorkshopStatus.draft)
        admin = make_user(UserRole.admin)
        assert client.get(f"/api/workshops/{workshop.id}", headers=auth_headers(owner)).status_code == 200
        assert client.get(f"/api/workshops/{workshop.id}", headers=auth_headers(admin)).status_code == 200

    def test_canceled_is_visible_only_to_participants_who_reserved(
        self, client: TestClient, db: Session, make_user, make_workshop
    ):
        workshop = make_workshop(make_user(UserRole.facilitator), status=WorkshopStatus.canceled)
        reserved = make_user()
        stranger = make_user()
        db.add(
            Reservation(
                workshop_id=workshop.id,
                user_id=reserved.id,
                contact="a@example.com",
                ticket_count=1,
                status=ReservationStatus.confirmed,
            )
        )
        db.commit()
        assert client.get(f"/api/workshops/{workshop.id}", headers=auth_headers(reserved)).status_code == 200
        assert client.get(f"/api/workshops/{workshop.id}", headers=auth_headers(stranger)).status_code == 404

    def test_participant_info_is_shown_only_to_reserved_and_owner(
        self, client: TestClient, db: Session, make_user, make_workshop
    ):
        owner = make_user(UserRole.facilitator)
        workshop = make_workshop(owner, participant_guide="集合は1階", emergency_contact="090-0000-0000")
        reserved = make_user()
        stranger = make_user()
        db.add(
            Reservation(
                workshop_id=workshop.id,
                user_id=reserved.id,
                contact="a@example.com",
                ticket_count=1,
            )
        )
        db.commit()

        def info(headers):
            return client.get(f"/api/workshops/{workshop.id}", headers=headers).json()["participant_info"]

        assert info({}) is None
        assert info(auth_headers(stranger)) is None
        assert info(auth_headers(reserved))["guide"] == "集合は1階"
        assert info(auth_headers(owner))["emergency_contact"] == "090-0000-0000"


class TestCreateWorkshop:
    def _payload(self, **overrides):
        payload = {
            "title": "新しいワークショップ",
            "description": "説明",
            "location": "東京都新宿区",
            "start_at": "2099-01-01T10:00:00Z",
            "end_at": "2099-01-01T12:00:00Z",
            "capacity": 5,
            "status": "published",
        }
        payload.update(overrides)
        return payload

    def test_facilitator_can_create(self, client: TestClient, make_user):
        facilitator = make_user(UserRole.facilitator)
        res = client.post("/api/workshops", json=self._payload(), headers=auth_headers(facilitator))
        assert res.status_code == 201
        assert res.json()["facilitator_id"] == facilitator.id

    def test_participant_cannot_create(self, client: TestClient, make_user):
        res = client.post("/api/workshops", json=self._payload(), headers=auth_headers(make_user()))
        assert res.status_code == 403

    def test_cannot_create_as_canceled(self, client: TestClient, make_user):
        facilitator = make_user(UserRole.facilitator)
        res = client.post("/api/workshops", json=self._payload(status="canceled"), headers=auth_headers(facilitator))
        assert res.status_code == 409

    def test_cannot_create_in_the_past(self, client: TestClient, make_user):
        facilitator = make_user(UserRole.facilitator)
        payload = self._payload(start_at="2000-01-01T10:00:00Z", end_at="2000-01-01T12:00:00Z")
        assert client.post("/api/workshops", json=payload, headers=auth_headers(facilitator)).status_code == 409


class TestUpdateWorkshop:
    def test_owner_can_update(self, client: TestClient, make_user, make_workshop):
        owner = make_user(UserRole.facilitator)
        workshop = make_workshop(owner)
        res = client.put(
            f"/api/workshops/{workshop.id}",
            json=workshop_payload(workshop, title="変更後"),
            headers=auth_headers(owner),
        )
        assert res.status_code == 200
        assert res.json()["title"] == "変更後"

    def test_admin_can_update_others(self, client: TestClient, make_user, make_workshop):
        workshop = make_workshop(make_user(UserRole.facilitator))
        admin = make_user(UserRole.admin)
        res = client.put(
            f"/api/workshops/{workshop.id}", json=workshop_payload(workshop, title="運営が変更"), headers=auth_headers(admin)
        )
        assert res.status_code == 200

    def test_other_facilitator_cannot_update(self, client: TestClient, make_user, make_workshop):
        workshop = make_workshop(make_user(UserRole.facilitator))
        other = make_user(UserRole.facilitator)
        res = client.put(f"/api/workshops/{workshop.id}", json=workshop_payload(workshop), headers=auth_headers(other))
        assert res.status_code == 403

    def test_missing_is_404(self, client: TestClient, make_user, make_workshop):
        owner = make_user(UserRole.facilitator)
        workshop = make_workshop(owner)
        res = client.put("/api/workshops/9999", json=workshop_payload(workshop), headers=auth_headers(owner))
        assert res.status_code == 404

    def test_published_conditions_are_locked(self, client: TestClient, make_user, make_workshop):
        owner = make_user(UserRole.facilitator)
        workshop = make_workshop(owner)
        res = client.put(
            f"/api/workshops/{workshop.id}", json=workshop_payload(workshop, price=1000), headers=auth_headers(owner)
        )
        assert res.status_code == 409
        assert "参加費" in res.json()["detail"]

    def test_published_cannot_change_participant_guide(self, client: TestClient, make_user, make_workshop):
        """当日の案内は予約の確定時に送っているので、公開後は変えさせない(追加の連絡は一斉送信で行う)"""
        owner = make_user(UserRole.facilitator)
        workshop = make_workshop(owner)
        for overrides, label in (({"participant_guide": "1階受付へ"}, "当日のご案内"), ({"emergency_contact": "090"}, "緊急連絡先")):
            res = client.put(
                f"/api/workshops/{workshop.id}", json=workshop_payload(workshop, **overrides), headers=auth_headers(owner)
            )
            assert res.status_code == 409
            assert label in res.json()["detail"]

    def test_draft_can_change_participant_guide(self, client: TestClient, make_user, make_workshop):
        owner = make_user(UserRole.facilitator)
        workshop = make_workshop(owner, status=WorkshopStatus.draft)
        res = client.put(
            f"/api/workshops/{workshop.id}",
            json=workshop_payload(workshop, participant_guide="1階受付へ"),
            headers=auth_headers(owner),
        )
        assert res.status_code == 200

    def test_published_cannot_return_to_draft(self, client: TestClient, make_user, make_workshop):
        owner = make_user(UserRole.facilitator)
        workshop = make_workshop(owner)
        res = client.put(
            f"/api/workshops/{workshop.id}", json=workshop_payload(workshop, status="draft"), headers=auth_headers(owner)
        )
        assert res.status_code == 409

    def test_canceled_cannot_be_edited(self, client: TestClient, make_user, make_workshop):
        owner = make_user(UserRole.facilitator)
        workshop = make_workshop(owner, status=WorkshopStatus.canceled)
        res = client.put(f"/api/workshops/{workshop.id}", json=workshop_payload(workshop), headers=auth_headers(owner))
        assert res.status_code == 409

    def test_capacity_cannot_go_below_reserved(self, client: TestClient, db: Session, make_user, make_workshop):
        owner = make_user(UserRole.facilitator)
        workshop = make_workshop(owner)
        participant = make_user()
        db.add(
            Reservation(
                workshop_id=workshop.id,
                user_id=participant.id,
                contact="a@example.com",
                ticket_count=3,
            )
        )
        db.commit()
        res = client.put(
            f"/api/workshops/{workshop.id}", json=workshop_payload(workshop, capacity=2), headers=auth_headers(owner)
        )
        assert res.status_code == 409


class TestDeleteWorkshop:
    def test_owner_can_delete_draft(self, client: TestClient, make_user, make_workshop):
        owner = make_user(UserRole.facilitator)
        workshop = make_workshop(owner, status=WorkshopStatus.draft)
        assert client.delete(f"/api/workshops/{workshop.id}", headers=auth_headers(owner)).status_code == 204
        assert client.get(f"/api/workshops/{workshop.id}", headers=auth_headers(owner)).status_code == 404

    def test_published_and_canceled_cannot_be_deleted(self, client: TestClient, make_user, make_workshop):
        owner = make_user(UserRole.facilitator)
        for status in (WorkshopStatus.published, WorkshopStatus.canceled):
            workshop = make_workshop(owner, status=status)
            assert client.delete(f"/api/workshops/{workshop.id}", headers=auth_headers(owner)).status_code == 409

    def test_other_facilitator_cannot_delete(self, client: TestClient, make_user, make_workshop):
        workshop = make_workshop(make_user(UserRole.facilitator), status=WorkshopStatus.draft)
        other = make_user(UserRole.facilitator)
        assert client.delete(f"/api/workshops/{workshop.id}", headers=auth_headers(other)).status_code == 403
