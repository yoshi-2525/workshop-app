from datetime import timedelta

from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.timeutil import utcnow_naive
from app.models.notification import Notification, NotificationType
from app.models.reservation import Reservation, ReservationStatus
from app.models.workshop import Workshop, WorkshopStatus

# Reminders fire once per workshop per participant. Each scheduler tick looks at
# every published workshop starting within REMINDER_LOOKAHEAD, so a workshop is
# covered even when it is published (or booked) less than a day before it starts;
# the unique constraint on (user_id, workshop_id, type) keeps it to one per user.
REMINDER_LOOKAHEAD = timedelta(hours=25)

# 複数のワーカー・プロセスで同時にリマインダーを作らないための MySQL の名前付きロック
_REMINDER_LOCK_NAME = "workshop_app_reminder_job"


def _confirmed_participant_ids(db: Session, workshop_id: int) -> list[int]:
    stmt = select(Reservation.user_id).where(
        Reservation.workshop_id == workshop_id, Reservation.status == ReservationStatus.confirmed
    )
    return list(db.scalars(stmt))


def _add_missing(
    db: Session, workshop_id: int, user_ids: list[int], type_: NotificationType, message: str
) -> int:
    """まだ同じ種類の通知を受け取っていない参加者にだけ通知を追加する(commit は呼び出し側)"""
    if not user_ids:
        return 0
    already = set(
        db.scalars(
            select(Notification.user_id).where(
                Notification.workshop_id == workshop_id,
                Notification.type == type_,
                Notification.user_id.in_(user_ids),
            )
        )
    )
    new_ids = [user_id for user_id in user_ids if user_id not in already]
    db.add_all(
        Notification(user_id=user_id, workshop_id=workshop_id, type=type_, message=message)
        for user_id in new_ids
    )
    return len(new_ids)


def add_cancellation_notices(db: Session, workshop: Workshop) -> int:
    """中止の通知を追加する。中止への変更と同じトランザクションで commit すること"""
    message = f"「{workshop.title}」は主催者により中止になりました。"
    return _add_missing(
        db, workshop.id, _confirmed_participant_ids(db, workshop.id), NotificationType.cancellation, message
    )


def send_upcoming_reminders(db: Session) -> int:
    """開催が近いワークショップの予約者にリマインダーを作り、作った件数を返す"""
    # GET_LOCK は接続ごとに持つロック。セッションの接続は commit のたびにプールへ返るので、
    # ロック専用の接続を別に確保して、処理が終わるまで持ち続ける
    with db.get_bind().connect() as lock_conn:
        got_lock = lock_conn.scalar(text("SELECT GET_LOCK(:name, 0)"), {"name": _REMINDER_LOCK_NAME})
        if got_lock != 1:
            # 他のプロセスが実行中
            return 0
        try:
            return _send_upcoming_reminders(db)
        finally:
            lock_conn.scalar(text("SELECT RELEASE_LOCK(:name)"), {"name": _REMINDER_LOCK_NAME})


def _send_upcoming_reminders(db: Session) -> int:
    now = utcnow_naive()
    workshops = db.scalars(
        select(Workshop).where(
            Workshop.status == WorkshopStatus.published,
            Workshop.start_at > now,
            Workshop.start_at <= now + REMINDER_LOOKAHEAD,
        )
    ).all()
    sent = 0
    for workshop in workshops:
        message = f"「{workshop.title}」の開催が近づいています。お忘れなくご参加ください。"
        added = _add_missing(
            db, workshop.id, _confirmed_participant_ids(db, workshop.id), NotificationType.reminder, message
        )
        try:
            db.commit()
        except IntegrityError:
            # 確認してから追加するまでの間に、別の経路で同じ通知が作られた場合。次の実行で改めて作る
            db.rollback()
            continue
        sent += added
    return sent
