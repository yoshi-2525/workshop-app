"""参加者から主催者への問い合わせ。

やり取りはワークショップと参加者の組み合わせごとに1つにまとめる。
見られるのは問い合わせた参加者と、そのワークショップの主催者だけ(管理者でも他人のやり取りは見られない)
"""

from collections.abc import Sequence

from sqlalchemy import ColumnElement, Select, and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.errors import WORKSHOP_NOT_FOUND, conflict, not_found
from app.core.timeutil import utcnow_naive
from app.models.inquiry import Inquiry, InquiryMessage
from app.models.user import User
from app.models.workshop import Workshop, WorkshopStatus
from app.schemas.inquiry import InquiryDetail, InquiryMessageRead, InquirySummary
from app.services.participants import confirmed_participant_ids

INQUIRY_NOT_FOUND = "問い合わせが見つかりません"

# _to_summaries は ワークショップ名・主催者・参加者を参照するので、問い合わせはこれを付けて読み込む
INQUIRY_LOAD_OPTIONS = (
    selectinload(Inquiry.workshop).selectinload(Workshop.facilitator),
    selectinload(Inquiry.participant),
)


def is_participant(inquiry: Inquiry, user: User) -> bool:
    return inquiry.participant_id == user.id


def _involves(user: User) -> ColumnElement[bool]:
    """自分が参加者または主催者として関わる問い合わせに絞る条件(Workshop との結合が必要)"""
    return or_(Inquiry.participant_id == user.id, Workshop.facilitator_id == user.id)


def _unread_condition(user: User) -> ColumnElement[bool]:
    """相手から届いた、まだ読んでいないメッセージの条件(Inquiry・Workshop との結合が必要)"""
    return and_(
        InquiryMessage.sender_id != user.id,
        or_(
            and_(Inquiry.participant_id == user.id, InquiryMessage.id > Inquiry.participant_last_read_id),
            and_(Workshop.facilitator_id == user.id, InquiryMessage.id > Inquiry.facilitator_last_read_id),
        ),
    )


# --- 取得 ---


def my_inquiries_select(user: User, workshop_id: int | None = None) -> Select[tuple[Inquiry]]:
    """自分が関わる問い合わせを、最後のやり取りが新しい順で返す SELECT。workshop_id で1つのワークショップに絞れる"""
    stmt = (
        select(Inquiry)
        .join(Workshop, Workshop.id == Inquiry.workshop_id)
        .options(*INQUIRY_LOAD_OPTIONS)
        .where(_involves(user))
        .order_by(Inquiry.last_message_at.desc(), Inquiry.id.desc())
    )
    if workshop_id is not None:
        stmt = stmt.where(Inquiry.workshop_id == workshop_id)
    return stmt


def unread_count(db: Session, user: User) -> int:
    """自分が関わるすべての問い合わせの、未読メッセージの合計"""
    count = db.scalar(
        select(func.count())
        .select_from(InquiryMessage)
        .join(Inquiry, Inquiry.id == InquiryMessage.inquiry_id)
        .join(Workshop, Workshop.id == Inquiry.workshop_id)
        .where(_unread_condition(user))
    )
    return count or 0


def get_my_inquiry(db: Session, inquiry_id: int, user: User) -> Inquiry:
    """自分が関わる問い合わせを取得する。関わっていないものは、存在しないのと同じく 404 にする"""
    inquiry = db.scalar(select(Inquiry).options(*INQUIRY_LOAD_OPTIONS).where(Inquiry.id == inquiry_id))
    if inquiry is None or not (is_participant(inquiry, user) or inquiry.workshop.facilitator_id == user.id):
        raise not_found(INQUIRY_NOT_FOUND)
    return inquiry


def ensure_inquirable(workshop: Workshop, user: User) -> None:
    """参加者として問い合わせできるかを確かめる。workshop は get_viewable_workshop で取得したものを渡すこと"""
    # 下書きは主催者・管理者しか見られないので、問い合わせの対象にしない
    if workshop.status == WorkshopStatus.draft:
        raise not_found(WORKSHOP_NOT_FOUND)
    if workshop.facilitator_id == user.id:
        raise conflict("自分が主催するワークショップには問い合わせできません")


def find_workshop_inquiry(db: Session, workshop_id: int, participant_id: int) -> Inquiry | None:
    """ワークショップについて、参加者が問い合わせたやり取り。まだなければ None"""
    return db.scalar(
        select(Inquiry)
        .options(*INQUIRY_LOAD_OPTIONS)
        .where(Inquiry.workshop_id == workshop_id, Inquiry.participant_id == participant_id)
    )


# --- 変換 ---


def to_inquiry_summaries(db: Session, inquiries: Sequence[Inquiry], user: User) -> list[InquirySummary]:
    """複数件をまとめて変換する。件数に関係なく、SQL は未読数と最後のメッセージの2回"""
    if not inquiries:
        return []
    ids = [i.id for i in inquiries]
    unread_rows = db.execute(
        select(InquiryMessage.inquiry_id, func.count())
        .join(Inquiry, Inquiry.id == InquiryMessage.inquiry_id)
        .join(Workshop, Workshop.id == Inquiry.workshop_id)
        .where(InquiryMessage.inquiry_id.in_(ids), _unread_condition(user))
        .group_by(InquiryMessage.inquiry_id)
    ).all()
    unread = {inquiry_id: count for inquiry_id, count in unread_rows}
    last_ids = (
        select(func.max(InquiryMessage.id)).where(InquiryMessage.inquiry_id.in_(ids)).group_by(InquiryMessage.inquiry_id)
    )
    last_messages = {
        m.inquiry_id: m.body for m in db.scalars(select(InquiryMessage).where(InquiryMessage.id.in_(last_ids)))
    }

    summaries = []
    for inquiry in inquiries:
        as_participant = is_participant(inquiry, user)
        counterpart = inquiry.workshop.facilitator if as_participant else inquiry.participant
        summaries.append(
            InquirySummary(
                id=inquiry.id,
                workshop_id=inquiry.workshop_id,
                workshop_title=inquiry.workshop.title,
                my_role="participant" if as_participant else "facilitator",
                counterpart_id=counterpart.id,
                counterpart_name=counterpart.name,
                counterpart_avatar_url=counterpart.avatar_url,
                last_message=last_messages.get(inquiry.id, ""),
                last_message_at=inquiry.last_message_at,
                unread_count=unread.get(inquiry.id, 0),
            )
        )
    return summaries


def to_inquiry_detail(db: Session, inquiry: Inquiry, user: User) -> InquiryDetail:
    summary = to_inquiry_summaries(db, [inquiry], user)[0]
    messages = db.scalars(
        select(InquiryMessage)
        .options(selectinload(InquiryMessage.sender))
        .where(InquiryMessage.inquiry_id == inquiry.id)
        .order_by(InquiryMessage.id)
    ).all()
    return InquiryDetail(
        **summary.model_dump(),
        messages=[
            InquiryMessageRead(
                id=m.id,
                sender_id=m.sender_id,
                sender_name=m.sender.name,
                is_mine=m.sender_id == user.id,
                body=m.body,
                is_broadcast=m.is_broadcast,
                created_at=m.created_at,
            )
            for m in messages
        ],
    )


# --- 変更(commit は呼び出し側) ---


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


def mark_read(db: Session, inquiry: Inquiry, user: User) -> None:
    """自分の既読位置を、最後のメッセージまで進める(commit は呼び出し側)"""
    last_id = db.scalar(select(func.max(InquiryMessage.id)).where(InquiryMessage.inquiry_id == inquiry.id)) or 0
    if is_participant(inquiry, user):
        inquiry.participant_last_read_id = max(inquiry.participant_last_read_id, last_id)
    else:
        inquiry.facilitator_last_read_id = max(inquiry.facilitator_last_read_id, last_id)


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


def send_participant_inquiry(db: Session, workshop: Workshop, user: User, body: str) -> Inquiry:
    """参加者が主催者に問い合わせる。初めてならやり取りを作り、既にあればそこにメッセージを追加する(commit は呼び出し側)"""
    inquiry = find_workshop_inquiry(db, workshop.id, user.id)
    if inquiry is None:
        # やり取りの作成とメッセージの追加を1つのトランザクションで確定し、空のやり取りを残さない
        db.add(Inquiry(workshop_id=workshop.id, participant_id=user.id, last_message_at=utcnow_naive()))
        try:
            db.flush()
        except IntegrityError:
            # 同時に送った別のリクエストが先に作った場合は、そちらに追加する。
            # まだ何も書き込んでいないので、トランザクションごと取り消して(読み取りの時点も新しくして)読み直す
            db.rollback()
        inquiry = find_workshop_inquiry(db, workshop.id, user.id)
        if inquiry is None:
            raise conflict("問い合わせを作成できませんでした")
    add_message(db, inquiry, user, body)
    return inquiry


def broadcast_to_participants(db: Session, workshop: Workshop, sender: User, body: str) -> int:
    """予約が確定している参加者全員とのやり取りに、同じメッセージを1通ずつ追加し、送った人数を返す(commit は呼び出し側)。

    一斉送信と予約の受付が同時に走っても送信対象が食い違わないよう、workshop は lock_workshop で取得したものを渡すこと
    """
    # 下書きは予約を受け付けておらず、中止したものには中止のお知らせが届いているので、公開中のものだけ
    if workshop.status != WorkshopStatus.published:
        raise conflict("お知らせを送れるのは公開中のワークショップだけです")
    participant_ids = confirmed_participant_ids(db, workshop)
    if not participant_ids:
        raise conflict("お知らせを送る参加者がいません")
    for participant_id in participant_ids:
        inquiry = get_or_create_inquiry(db, workshop.id, participant_id)
        if inquiry is None:
            raise conflict("お知らせを送信できませんでした")
        add_message(db, inquiry, sender, body, is_broadcast=True)
    return len(participant_ids)
