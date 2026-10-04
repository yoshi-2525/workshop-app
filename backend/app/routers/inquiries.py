from collections.abc import Sequence
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_user, require_roles
from app.core.timeutil import utcnow_naive
from app.database import get_db
from app.models.inquiry import Inquiry, InquiryMessage
from app.models.reservation import Reservation, ReservationStatus
from app.models.user import User, UserRole
from app.models.workshop import Workshop, WorkshopStatus
from app.schemas.inquiry import (
    InquiryBroadcastResult,
    InquiryDetail,
    InquiryMessageCreate,
    InquiryMessageRead,
    InquirySummary,
)
from app.services.inquiries import add_message, get_or_create_inquiry, is_participant
from app.services.pagination import PageQuery, paginate
from app.services.workshops import get_viewable_workshop, lock_workshop

# 参加者から主催者への問い合わせ。やり取りはワークショップと参加者の組み合わせごとに1つにまとめる。
# 見られるのは問い合わせた参加者と、そのワークショップの主催者だけ(管理者でも他人のやり取りは見られない)
router = APIRouter(tags=["inquiries"])

_NOT_FOUND = "問い合わせが見つかりません"


def _involves(user: User):
    """自分が参加者または主催者として関わる問い合わせに絞る条件(Workshop との結合が必要)"""
    return or_(Inquiry.participant_id == user.id, Workshop.facilitator_id == user.id)


def _unread_condition(user: User):
    """相手から届いた、まだ読んでいないメッセージの条件(Inquiry・Workshop との結合が必要)"""
    return and_(
        InquiryMessage.sender_id != user.id,
        or_(
            and_(Inquiry.participant_id == user.id, InquiryMessage.id > Inquiry.participant_last_read_id),
            and_(Workshop.facilitator_id == user.id, InquiryMessage.id > Inquiry.facilitator_last_read_id),
        ),
    )


def _load_options():
    return (
        selectinload(Inquiry.workshop).selectinload(Workshop.facilitator),
        selectinload(Inquiry.participant),
    )


def _to_summaries(db: Session, inquiries: Sequence[Inquiry], user: User) -> list[InquirySummary]:
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
    last_ids = select(func.max(InquiryMessage.id)).where(InquiryMessage.inquiry_id.in_(ids)).group_by(
        InquiryMessage.inquiry_id
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


def _to_detail(db: Session, inquiry: Inquiry, user: User) -> InquiryDetail:
    summary = _to_summaries(db, [inquiry], user)[0]
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


def _get_my_inquiry(db: Session, inquiry_id: int, user: User) -> Inquiry:
    inquiry = db.scalar(select(Inquiry).options(*_load_options()).where(Inquiry.id == inquiry_id))
    # 関わっていない問い合わせは、存在しないのと同じく 404 にする
    if inquiry is None or not (
        inquiry.participant_id == user.id or inquiry.workshop.facilitator_id == user.id
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND)
    return inquiry


class InquiryListQuery(PageQuery):
    # 指定すると、1つのワークショップへの問い合わせだけに絞る
    workshop_id: int | None = None


@router.get("/inquiries", response_model=list[InquirySummary])
def list_inquiries(
    query: Annotated[InquiryListQuery, Query()],
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[InquirySummary]:
    """自分が関わる問い合わせを、最後のやり取りが新しい順で返す。workshop_id で1つのワークショップに絞れる"""
    stmt = (
        select(Inquiry)
        .join(Workshop, Workshop.id == Inquiry.workshop_id)
        .options(*_load_options())
        .where(_involves(current_user))
        .order_by(Inquiry.last_message_at.desc(), Inquiry.id.desc())
    )
    if query.workshop_id is not None:
        stmt = stmt.where(Inquiry.workshop_id == query.workshop_id)
    inquiries = db.scalars(paginate(db, stmt, query, response)).all()
    return _to_summaries(db, inquiries, current_user)


@router.get("/inquiries/unread-count")
def get_inquiry_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, int]:
    count = db.scalar(
        select(func.count())
        .select_from(InquiryMessage)
        .join(Inquiry, Inquiry.id == InquiryMessage.inquiry_id)
        .join(Workshop, Workshop.id == Inquiry.workshop_id)
        .where(_unread_condition(current_user))
    )
    return {"count": count or 0}


@router.get("/inquiries/{inquiry_id}", response_model=InquiryDetail)
def get_inquiry(
    inquiry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InquiryDetail:
    return _to_detail(db, _get_my_inquiry(db, inquiry_id, current_user), current_user)


@router.post("/inquiries/{inquiry_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_inquiry_read(
    inquiry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    inquiry = _get_my_inquiry(db, inquiry_id, current_user)
    last_id = db.scalar(select(func.max(InquiryMessage.id)).where(InquiryMessage.inquiry_id == inquiry.id)) or 0
    if is_participant(inquiry, current_user):
        inquiry.participant_last_read_id = max(inquiry.participant_last_read_id, last_id)
    else:
        inquiry.facilitator_last_read_id = max(inquiry.facilitator_last_read_id, last_id)
    db.commit()


@router.post(
    "/inquiries/{inquiry_id}/messages",
    response_model=InquiryDetail,
    status_code=status.HTTP_201_CREATED,
)
def reply_inquiry(
    inquiry_id: int,
    payload: InquiryMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InquiryDetail:
    inquiry = _get_my_inquiry(db, inquiry_id, current_user)
    add_message(db, inquiry, current_user, payload.body)
    db.commit()
    db.refresh(inquiry)
    return _to_detail(db, inquiry, current_user)


def _get_inquirable_workshop(db: Session, workshop_id: int, user: User) -> Workshop:
    workshop = get_viewable_workshop(db, workshop_id, user)
    # 下書きは主催者・管理者しか見られないので、問い合わせの対象にしない
    if workshop.status == WorkshopStatus.draft:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ワークショップが見つかりません")
    if workshop.facilitator_id == user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="自分が主催するワークショップには問い合わせできません"
        )
    return workshop


def _find_workshop_inquiry(db: Session, workshop_id: int, user: User) -> Inquiry | None:
    return db.scalar(
        select(Inquiry)
        .options(*_load_options())
        .where(Inquiry.workshop_id == workshop_id, Inquiry.participant_id == user.id)
    )


@router.get("/workshops/{workshop_id}/inquiry", response_model=InquiryDetail | None)
def get_workshop_inquiry(
    workshop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InquiryDetail | None:
    """このワークショップについて自分が問い合わせたやり取りを返す。まだ問い合わせていなければ null"""
    _get_inquirable_workshop(db, workshop_id, current_user)
    inquiry = _find_workshop_inquiry(db, workshop_id, current_user)
    return None if inquiry is None else _to_detail(db, inquiry, current_user)


@router.post(
    "/workshops/{workshop_id}/inquiry/messages",
    response_model=InquiryDetail,
    status_code=status.HTTP_201_CREATED,
)
def send_workshop_inquiry(
    workshop_id: int,
    payload: InquiryMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InquiryDetail:
    """主催者に問い合わせる。初めてならやり取りを作り、既にあればそこにメッセージを追加する"""
    _get_inquirable_workshop(db, workshop_id, current_user)
    inquiry = _find_workshop_inquiry(db, workshop_id, current_user)
    if inquiry is None:
        # やり取りの作成とメッセージの追加を1つのトランザクションで確定し、空のやり取りを残さない
        db.add(Inquiry(workshop_id=workshop_id, participant_id=current_user.id, last_message_at=utcnow_naive()))
        try:
            db.flush()
        except IntegrityError:
            # 同時に送った別のリクエストが先に作った場合は、そちらに追加する。
            # まだ何も書き込んでいないので、トランザクションごと取り消して(読み取りの時点も新しくして)読み直す
            db.rollback()
        inquiry = _find_workshop_inquiry(db, workshop_id, current_user)
        if inquiry is None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="問い合わせを作成できませんでした")
    add_message(db, inquiry, current_user, payload.body)
    db.commit()
    db.refresh(inquiry)
    return _to_detail(db, inquiry, current_user)


@router.post(
    "/workshops/{workshop_id}/inquiry/broadcast",
    response_model=InquiryBroadcastResult,
    status_code=status.HTTP_201_CREATED,
)
def broadcast_workshop_inquiry(
    workshop_id: int,
    payload: InquiryMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.facilitator)),
) -> InquiryBroadcastResult:
    """主催者が、予約が確定している参加者全員にお知らせを送る。

    各参加者とのやり取りに同じメッセージを1通ずつ追加する(やり取りがなければ作る)。
    やり取りは参加者と主催者だけのものなので、管理者でも他人のワークショップからは送れない
    """
    # 一斉送信と予約の受付が同時に走っても、送信対象の参加者が食い違わないよう行をロックする
    workshop = lock_workshop(db, workshop_id)
    if workshop is None or workshop.facilitator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ワークショップが見つかりません")
    # 下書きは予約を受け付けておらず、中止したものには中止のお知らせが届いているので、公開中のものだけ
    if workshop.status != WorkshopStatus.published:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="お知らせを送れるのは公開中のワークショップだけです"
        )

    participant_ids = db.scalars(
        select(Reservation.user_id)
        .where(
            Reservation.workshop_id == workshop.id,
            Reservation.status == ReservationStatus.confirmed,
            # 自分自身とのやり取りは作らない
            Reservation.user_id != workshop.facilitator_id,
        )
        .distinct()
    ).all()
    if not participant_ids:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="お知らせを送る参加者がいません")

    # 全員分をまとめて確定する(途中で失敗したら誰にも届かない)
    for participant_id in participant_ids:
        inquiry = get_or_create_inquiry(db, workshop.id, participant_id)
        if inquiry is None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="お知らせを送信できませんでした")
        add_message(db, inquiry, current_user, payload.body, is_broadcast=True)
    db.commit()
    return InquiryBroadcastResult(sent_count=len(participant_ids))
