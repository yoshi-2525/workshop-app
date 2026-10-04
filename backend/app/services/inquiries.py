from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.timeutil import utcnow_naive
from app.models.inquiry import Inquiry, InquiryMessage
from app.models.user import User


def is_participant(inquiry: Inquiry, user: User) -> bool:
    return inquiry.participant_id == user.id


def add_message(db: Session, inquiry: Inquiry, user: User, body: str, *, is_broadcast: bool = False) -> None:
    """メッセージを追加し、送った本人の既読位置も進める(commit は呼び出し側)"""
    message = InquiryMessage(inquiry_id=inquiry.id, sender_id=user.id, body=body, is_broadcast=is_broadcast)
    db.add(message)
    db.flush()
    inquiry.last_message_at = utcnow_naive()
    # 一斉送信は個々のやり取りを開いて送るわけではないので、相手からの未読メッセージを既読にしない
    # (自分が送ったメッセージは未読に数えないので、既読位置を進めなくてよい)
    if is_broadcast:
        return
    if is_participant(inquiry, user):
        inquiry.participant_last_read_id = message.id
    else:
        inquiry.facilitator_last_read_id = message.id


def get_or_create_inquiry(db: Session, workshop_id: int, participant_id: int) -> Inquiry | None:
    """参加者とのやり取りを返す。まだなければ作る(commit は呼び出し側)。作れなかったときは None"""
    stmt = select(Inquiry).where(Inquiry.workshop_id == workshop_id, Inquiry.participant_id == participant_id)
    inquiry = db.scalar(stmt)
    if inquiry is not None:
        return inquiry
    try:
        # 参加者が同時に初めての問い合わせを送って先に作った場合に、それまでの追加を取り消さないよう、
        # セーブポイントの中で作る
        with db.begin_nested():
            inquiry = Inquiry(workshop_id=workshop_id, participant_id=participant_id, last_message_at=utcnow_naive())
            db.add(inquiry)
        return inquiry
    except IntegrityError:
        return db.scalar(stmt)
