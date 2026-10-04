"""開催前日のリマインダーと、当日の案内のメッセージ"""

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.timeutil import utcnow_naive
from app.models.inquiry import Inquiry, InquiryMessage
from app.models.notification import Notification, NotificationType
from app.models.reservation import Reservation, ReservationStatus
from app.models.user import UserRole
from app.services.notifications import _send_upcoming_reminders


def _reserve(db: Session, workshop, user, status=ReservationStatus.confirmed) -> None:
    db.add(
        Reservation(
            workshop_id=workshop.id, user_id=user.id, attendee_name="x", contact="a@example.com", ticket_count=1, status=status
        )
    )
    db.commit()


def test_reminder_and_guide_are_sent_once(db: Session, make_user, make_workshop):
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

    messages = db.scalars(select(InquiryMessage).join(Inquiry).where(Inquiry.participant_id == confirmed.id)).all()
    assert len(messages) == 1
    assert messages[0].is_broadcast and "1階受付へ" in messages[0].body

    # 2回目は送らない
    assert _send_upcoming_reminders(db) == 0


def test_far_future_workshop_is_not_reminded(db: Session, make_user, make_workshop):
    workshop = make_workshop(make_user(UserRole.facilitator), start_at=utcnow_naive() + timedelta(days=3))
    _reserve(db, workshop, make_user())
    assert _send_upcoming_reminders(db) == 0
