from datetime import timedelta

from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.timeutil import utcnow_naive
from app.models.notification import Notification, NotificationType
from app.models.reservation import Reservation
from app.models.workshop import Workshop, WorkshopStatus
from app.services.inquiries import add_message, get_or_create_inquiry
from app.services.participants import confirmed_participant_ids

# リマインダーは、ワークショップごと・参加者ごとに1回だけ送る。定期実行のたびに
# REMINDER_LOOKAHEAD 以内に始まる公開中のワークショップをすべて見るので、開始の1日前を切ってから
# 公開・予約されたものにも届く。(user_id, workshop_id, type) の一意制約で1人1回に限る。
REMINDER_LOOKAHEAD = timedelta(hours=25)

# 複数のワーカー・プロセスで同時にリマインダーを作らないための MySQL の名前付きロック
_REMINDER_LOCK_NAME = "workshop_app_reminder_job"


def _add_missing(
    db: Session, workshop_id: int, user_ids: list[int], type_: NotificationType, message: str
) -> list[int]:
    """まだ同じ種類の通知を受け取っていない参加者にだけ通知を追加し、追加した相手を返す(commit は呼び出し側)"""
    if not user_ids:
        return []
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
    return new_ids


def add_cancellation_notices(db: Session, workshop: Workshop) -> int:
    """中止の通知を追加する。中止への変更と同じトランザクションで commit すること"""
    message = f"「{workshop.title}」は主催者により中止になりました。"
    return len(
        _add_missing(
            db, workshop.id, confirmed_participant_ids(db, workshop), NotificationType.cancellation, message
        )
    )


def add_reservation_canceled_notice(db: Session, reservation: Reservation) -> int:
    """主催者が参加をキャンセルしたことを参加者に通知する。キャンセルと同じトランザクションで commit すること"""
    message = f"「{reservation.workshop.title}」への参加は主催者によりキャンセルされました。"
    return len(
        _add_missing(
            db, reservation.workshop_id, [reservation.user_id], NotificationType.reservation_canceled, message
        )
    )


def _has_participant_guide(workshop: Workshop) -> bool:
    return bool(workshop.participant_guide or workshop.emergency_contact)


def reminder_message(workshop: Workshop) -> str:
    """開催前日のリマインダー(通知)の本文。当日の案内はメッセージで別に届けるので、ここには載せない"""
    message = f"「{workshop.title}」の開催が近づいています。お忘れなくご参加ください。"
    if _has_participant_guide(workshop):
        message += "当日のご案内を主催者からのメッセージでお送りしましたので、ご確認ください。"
    return message


def participant_guide_message(workshop: Workshop) -> str:
    """開催前日に、主催者から参加者へのメッセージとして送る当日の案内・緊急連絡先"""
    parts = [f"「{workshop.title}」へのご参加ありがとうございます。当日のご案内をお送りします。"]
    if workshop.participant_guide:
        parts.append(f"【当日のご案内】\n{workshop.participant_guide}")
    if workshop.emergency_contact:
        parts.append(f"【緊急連絡先】\n{workshop.emergency_contact}")
    return "\n\n".join(parts)


def _send_participant_guide(db: Session, workshop: Workshop, user_ids: list[int]) -> None:
    """当日の案内を、主催者からの一斉送信のメッセージとして各参加者とのやり取りに追加する(commit は呼び出し側)"""
    if not user_ids or not _has_participant_guide(workshop):
        return
    body = participant_guide_message(workshop)
    for user_id in user_ids:
        inquiry = get_or_create_inquiry(db, workshop.id, user_id)
        if inquiry is None:
            # やり取りを作れなかった場合。リマインダーごと取り消し、次の実行で改めて送る
            raise RuntimeError("inquiry could not be created")
        add_message(db, inquiry, workshop.facilitator, body, is_broadcast=True)


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
        # リマインダーと当日の案内のメッセージは、同じ参加者に同じトランザクションで1回だけ送る
        # (リマインダーの通知が一意なので、通知を新しく作った相手にだけメッセージも送れば重複しない)
        added = _add_missing(
            db,
            workshop.id,
            confirmed_participant_ids(db, workshop),
            NotificationType.reminder,
            reminder_message(workshop),
        )
        try:
            _send_participant_guide(db, workshop, added)
            db.commit()
        except (IntegrityError, RuntimeError):
            # 確認してから追加するまでの間に別の経路で同じ通知が作られた、またはやり取りを作れなかった場合。
            # 通知もメッセージも取り消し、次の実行で改めて送る
            db.rollback()
            continue
        sent += len(added)
    return sent
