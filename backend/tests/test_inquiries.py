"""問い合わせ(参加者と主催者のやり取り)・一斉送信"""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.reservation import Reservation, ReservationStatus
from app.models.user import UserRole
from app.models.workshop import WorkshopStatus
from tests.conftest import auth_headers


def _send(client: TestClient, workshop_id: int, user, body: str = "質問です"):
    return client.post(f"/api/workshops/{workshop_id}/inquiry/messages", json={"body": body}, headers=auth_headers(user))


def _add_reservation(db: Session, workshop, user, status=ReservationStatus.confirmed) -> None:
    db.add(
        Reservation(
            workshop_id=workshop.id,
            user_id=user.id,
            contact="a@example.com",
            ticket_count=1,
            status=status,
        )
    )
    db.commit()


class TestInquiryThread:
    def test_conversation_and_unread(self, client: TestClient, make_user, make_workshop):
        owner = make_user(UserRole.facilitator)
        workshop = make_workshop(owner)
        participant = make_user()

        # まだ問い合わせていなければ null
        assert client.get(f"/api/workshops/{workshop.id}/inquiry", headers=auth_headers(participant)).json() is None

        sent = _send(client, workshop.id, participant)
        assert sent.status_code == 201
        detail = sent.json()
        assert detail["my_role"] == "participant"
        assert detail["counterpart_id"] == owner.id
        assert [m["is_mine"] for m in detail["messages"]] == [True]
        inquiry_id = detail["id"]

        # 2回目は同じやり取りに追加される
        assert _send(client, workshop.id, participant, "追加の質問").json()["id"] == inquiry_id

        # 主催者側: 未読2件
        owner_headers = auth_headers(owner)
        assert client.get("/api/inquiries/unread-count", headers=owner_headers).json() == {"count": 2}
        summaries = client.get("/api/inquiries", headers=owner_headers).json()
        assert [(s["id"], s["my_role"], s["unread_count"], s["last_message"]) for s in summaries] == [
            (inquiry_id, "facilitator", 2, "追加の質問")
        ]

        # 既読にすると 0、返信すると参加者側に未読1件
        assert client.post(f"/api/inquiries/{inquiry_id}/read", headers=owner_headers).status_code == 204
        assert client.get("/api/inquiries/unread-count", headers=owner_headers).json() == {"count": 0}
        reply = client.post(f"/api/inquiries/{inquiry_id}/messages", json={"body": "回答です"}, headers=owner_headers)
        assert reply.status_code == 201
        assert len(reply.json()["messages"]) == 3
        assert client.get("/api/inquiries/unread-count", headers=auth_headers(participant)).json() == {"count": 1}

    def test_others_cannot_see_thread(self, client: TestClient, make_user, make_workshop):
        workshop = make_workshop(make_user(UserRole.facilitator))
        inquiry_id = _send(client, workshop.id, make_user()).json()["id"]
        # 管理者でも、関わっていないやり取りは存在しないのと同じく 404
        for outsider in (make_user(), make_user(UserRole.admin)):
            assert client.get(f"/api/inquiries/{inquiry_id}", headers=auth_headers(outsider)).status_code == 404
            assert client.get("/api/inquiries", headers=auth_headers(outsider)).json() == []

    def test_cannot_inquire_own_or_draft(self, client: TestClient, make_user, make_workshop):
        owner = make_user(UserRole.facilitator)
        assert _send(client, make_workshop(owner).id, owner).status_code == 409
        draft = make_workshop(owner, status=WorkshopStatus.draft)
        assert _send(client, draft.id, make_user()).status_code == 404

    def test_filter_by_workshop(self, client: TestClient, make_user, make_workshop):
        owner = make_user(UserRole.facilitator)
        first, second = make_workshop(owner), make_workshop(owner)
        participant = make_user()
        _send(client, first.id, participant)
        _send(client, second.id, participant)
        res = client.get("/api/inquiries", params={"workshop_id": second.id}, headers=auth_headers(owner))
        assert [s["workshop_id"] for s in res.json()] == [second.id]


class TestBroadcast:
    def _broadcast(self, client: TestClient, workshop_id: int, user):
        return client.post(
            f"/api/workshops/{workshop_id}/inquiry/broadcast", json={"body": "お知らせ"}, headers=auth_headers(user)
        )

    def test_sends_to_confirmed_participants_only(
        self, client: TestClient, db: Session, make_user, make_workshop
    ):
        owner = make_user(UserRole.facilitator)
        workshop = make_workshop(owner)
        confirmed, canceled = make_user(), make_user()
        _add_reservation(db, workshop, confirmed)
        _add_reservation(db, workshop, canceled, ReservationStatus.canceled)

        res = self._broadcast(client, workshop.id, owner)
        assert res.status_code == 201
        assert res.json() == {"sent_count": 1}

        thread = client.get(f"/api/workshops/{workshop.id}/inquiry", headers=auth_headers(confirmed)).json()
        assert [(m["body"], m["is_broadcast"]) for m in thread["messages"]] == [("お知らせ", True)]
        assert client.get(f"/api/workshops/{workshop.id}/inquiry", headers=auth_headers(canceled)).json() is None
        # 一斉送信でも、送った主催者側の未読は増えない
        assert client.get("/api/inquiries/unread-count", headers=auth_headers(owner)).json() == {"count": 0}

    def test_requires_participants_and_published(self, client: TestClient, make_user, make_workshop):
        owner = make_user(UserRole.facilitator)
        assert self._broadcast(client, make_workshop(owner).id, owner).status_code == 409
        draft = make_workshop(owner, status=WorkshopStatus.draft)
        assert self._broadcast(client, draft.id, owner).status_code == 409

    def test_only_own_workshop(self, client: TestClient, db: Session, make_user, make_workshop):
        workshop = make_workshop(make_user(UserRole.facilitator))
        _add_reservation(db, workshop, make_user())
        # 管理者でも、他人のワークショップからは送れない
        for other in (make_user(UserRole.facilitator), make_user(UserRole.admin)):
            assert self._broadcast(client, workshop.id, other).status_code == 404
