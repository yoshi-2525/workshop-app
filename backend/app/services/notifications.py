from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationType
from app.models.reservation import Reservation, ReservationStatus
from app.models.workshop import Workshop, WorkshopStatus

# Reminders fire once per workshop per participant; a scheduler tick every
# REMINDER_INTERVAL_MINUTES re-checks a window wide enough to guarantee each
# workshop is seen at least once, while the unique constraint on
# (user_id, workshop_id, type) makes repeat sightings no-ops.
REMINDER_WINDOW_START = timedelta(hours=23)
REMINDER_WINDOW_END = timedelta(hours=25)


def _confirmed_participant_ids(db: Session, workshop_id: int) -> list[int]:
    stmt = (
        db.query(Reservation.user_id)
        .filter(Reservation.workshop_id == workshop_id, Reservation.status == ReservationStatus.confirmed)
    )
    return [row[0] for row in stmt.all()]


def _create_if_absent(
    db: Session, user_id: int, workshop_id: int, type_: NotificationType, message: str
) -> None:
    db.add(Notification(user_id=user_id, workshop_id=workshop_id, type=type_, message=message))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()


def notify_workshop_canceled(db: Session, workshop: Workshop) -> None:
    message = f"「{workshop.title}」は主催者により中止になりました。"
    for user_id in _confirmed_participant_ids(db, workshop.id):
        _create_if_absent(db, user_id, workshop.id, NotificationType.cancellation, message)


def send_upcoming_reminders(db: Session) -> int:
    # start_at is stored as a naive UTC datetime (frontend sends `.toISOString()`).
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    workshops = (
        db.query(Workshop)
        .filter(
            Workshop.status == WorkshopStatus.published,
            Workshop.start_at >= now + REMINDER_WINDOW_START,
            Workshop.start_at <= now + REMINDER_WINDOW_END,
        )
        .all()
    )
    sent = 0
    for workshop in workshops:
        message = f"「{workshop.title}」は明日開催予定です。お忘れなくご参加ください。"
        for user_id in _confirmed_participant_ids(db, workshop.id):
            _create_if_absent(db, user_id, workshop.id, NotificationType.reminder, message)
            sent += 1
    return sent
