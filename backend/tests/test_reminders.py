"""予約の確定時に送る当日の案内のメッセージと、開催前日のリマインダー"""

from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.timeutil import utcnow_naive
from app.models.inquiry import Inquiry, InquiryMessage
from app.models.notification import Notification, NotificationType
from app.models.reservation import Reservation, ReservationStatus
from app.models.user import UserRole
from app.services.notifications import _send_upcoming_reminders
from tests.conftest import auth_headers


def _reserve(db: Session, workshop, user, status=ReservationStatus.confirmed) -> None:
    db.add(
        Reservation(
            workshop_id=workshop.id, user_id=user.id, contact="a@example.com", ticket_count=1, status=status
        )
    )
    db.commit()


def _reserve_via_api(client: TestClient, workshop_id: int, user):
    return client.post(
        f"/api/workshops/{workshop_id}/reservations",
        json={"contact": "me@example.com", "ticket_count": 1},
        headers=auth_headers(user),
    )


def _messages_to(db: Session, user) -> list[InquiryMessage]:
    db.expire_all()
    return list(db.scalars(select(InquiryMessage).join(Inquiry).where(Inquiry.participant_id == user.id)))


class TestParticipantGuide:
    def test_guide_is_sent_right_after_reservation(self, client: TestClient, db: Session, make_user, make_workshop):
        owner = make_user(UserRole.facilitator)
        workshop = make_workshop(owner, participant_guide="1階受付へ", emergency_contact="090")
        participant = make_user()

        assert _reserve_via_api(client, workshop.id, participant).status_code == 201

        messages = _messages_to(db, participant)
        assert len(messages) == 1
        assert messages[0].is_broadcast and messages[0].sender_id == owner.id
        assert "1階受付へ" in messages[0].body and "090" in messages[0].body

    def test_no_message_without_guide(self, client: TestClient, db: Session, make_user, make_workshop):
        workshop = make_workshop(make_user(UserRole.facilitator))
        participant = make_user()

        assert _reserve_via_api(client, workshop.id, participant).status_code == 201

        assert _messages_to(db, participant) == []


def test_reminder_is_sent_once_without_resending_guide(db: Session, make_user, make_workshop):
    # GET_LOCK(MySQL)を使う send_upcoming_reminders ではなく、中身の処理を直接呼ぶ
    owner = make_user(UserRole.facilitator)
    workshop = make_workshop(
        owner, start_at=utcnow_naive() + timedelta(hours=10), participant_guide="1階受付へ", emergency_contact="090"
    )
    confirmed, canceled = make_user(), make_user()
    _reserve(db, workshop, confirmed)
    _reserve(db, workshop, canceled, ReservationStatus.canceled)

    assert _send_upcoming_reminders(db) == 1
    reminders = db.scalars(select(Notification).where(Notification.type == NotificationType.reminder)).all()
    assert [n.user_id for n in reminders] == [confirmed.id]
    # 当日の案内は予約の確定時に送るので、リマインダーでは送らない
    assert _messages_to(db, confirmed) == []

    # 2回目は送らない
    assert _send_upcoming_reminders(db) == 0


def test_far_future_workshop_is_not_reminded(db: Session, make_user, make_workshop):
    workshop = make_workshop(make_user(UserRole.facilitator), start_at=utcnow_naive() + timedelta(days=3))
    _reserve(db, workshop, make_user())
    assert _send_upcoming_reminders(db) == 0
