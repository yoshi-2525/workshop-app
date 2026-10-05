from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.timeutil import utcnow_naive
from app.models.follow import FOLLOWABLE_ROLE, FacilitatorFollow
from app.models.notification import Notification, NotificationType
from app.models.reservation import CancelReason, Reservation
from app.models.workshop import Workshop, WorkshopStatus
from app.services.inquiries import add_message, get_or_create_inquiry
from app.services.job_lock import named_lock
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


def add_cancellation_notices(db: Session, workshop: Workshop, *, refunds_online_payment: bool = False) -> int:
    """中止の通知を追加する。中止への変更と同じトランザクションで commit すること。

    refunds_online_payment: オンライン決済のワークショップで、支払った参加費を全額返金するか
    """
    message = f"「{workshop.title}」は主催者により中止になりました。"
    if refunds_online_payment:
        message += "オンラインでお支払いいただいた参加費は全額返金します。"
    return len(
        _add_missing(
            db, workshop.id, confirmed_participant_ids(db, workshop), NotificationType.cancellation, message
        )
    )


def add_reservation_canceled_notice(
    db: Session, reservation: Reservation, *, refund_amount: int | None = None, reason: CancelReason | None = None
) -> int:
    """主催者が参加をキャンセルしたことを参加者に通知する。キャンセルと同じトランザクションで commit すること。

    オンライン決済で支払い済みなら、取消の理由と返金額も伝える(参加者都合では手数料を差し引くため、
    額を知らせて、納得できなければ問い合わせられるようにする)
    """
    message = f"「{reservation.workshop.title}」への参加は主催者によりキャンセルされました。"
    if refund_amount is not None:
        if reason == CancelReason.facilitator:
            message += f"主催者の都合による取消のため、お支払いいただいた参加費{refund_amount:,}円を全額返金します。"
        elif refund_amount > 0:
            message += (
                f"参加者のご都合による取消のため、決済手数料と本サービスの手数料を差し引いた{refund_amount:,}円を返金します。"
                "ご不明な点は主催者にお問い合わせください。"
            )
        else:
            message += (
                "参加者のご都合による取消のため、決済手数料と本サービスの手数料を差し引くと、返金できる額は残りませんでした。"
                "ご不明な点は主催者にお問い合わせください。"
            )
    return len(
        _add_missing(
            db, reservation.workshop_id, [reservation.user_id], NotificationType.reservation_canceled, message
        )
    )


def add_payment_refunded_notice(db: Session, reservation: Reservation, amount: int) -> int:
    """参加費の返金が済んだことを参加者に通知する。返金の記録と同じトランザクションで commit すること。

    通知は (参加者, ワークショップ, 種類) で一意なので、同じワークショップで2回目の返金があった場合
    (期限切れ後に届いた支払いを返金し、予約し直した支払いもさらに返金した、など)は通知を追加しない。
    返金そのものは行われ、予約一覧の表示で確かめられる
    """
    message = (
        f"「{reservation.workshop.title}」の参加費{amount:,}円を返金しました。"
        "カード会社の処理により、ご利用明細に反映されるまで日数がかかることがあります。"
    )
    return len(
        _add_missing(db, reservation.workshop_id, [reservation.user_id], NotificationType.payment_refunded, message)
    )


def add_payment_refund_failed_notice(db: Session, reservation: Reservation) -> int:
    """返金済みと知らせたあとに、Stripe 側で返金が失敗したことを参加者に知らせる(commit は呼び出し側)"""
    message = (
        f"「{reservation.workshop.title}」の参加費の返金を、カード会社の都合で完了できませんでした。"
        "運営で確認し、あらためてご連絡します。"
    )
    return len(
        _add_missing(
            db, reservation.workshop_id, [reservation.user_id], NotificationType.payment_refund_failed, message
        )
    )


def add_new_workshop_notices(db: Session, workshop: Workshop) -> int:
    """フォロワーに、主催者が新しいワークショップを公開したことを通知する。

    初めて公開したときに、公開と同じトランザクションで呼ぶこと(commit は呼び出し側)。
    通知するかはワークショップの持ち主で決める。運営が主催者の下書きを公開した場合も、主催者の新着として通知する。
    フォローの対象は主催者(FOLLOWABLE_ROLE)だけなので、運営が持ち主のものは通知しない
    """
    facilitator = workshop.facilitator
    if facilitator.role != FOLLOWABLE_ROLE:
        return 0
    follower_ids = list(
        db.scalars(
            select(FacilitatorFollow.follower_id).where(
                FacilitatorFollow.facilitator_id == facilitator.id,
                FacilitatorFollow.follower_id != facilitator.id,
            )
        )
    )
    message = f"フォロー中の{facilitator.name}さんが、新しいワークショップ「{workshop.title}」を公開しました。"
    return len(_add_missing(db, workshop.id, follower_ids, NotificationType.new_workshop, message))


def remove_new_workshop_notices(db: Session, workshop: Workshop) -> None:
    """新着の通知を取り消す。中止したワークショップは予約していない人には見えず、通知のリンク先がなくなるため
    (commit は呼び出し側)"""
    db.execute(
        delete(Notification).where(
            Notification.workshop_id == workshop.id, Notification.type == NotificationType.new_workshop
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
    with named_lock(db, _REMINDER_LOCK_NAME) as got_lock:
        if not got_lock:
            # 他のプロセスが実行中
            return 0
        return _send_upcoming_reminders(db)


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
