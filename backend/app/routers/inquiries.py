from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.core.errors import WORKSHOP_NOT_FOUND, not_found
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.inquiry import InquiryBroadcastResult, InquiryDetail, InquiryMessageCreate, InquirySummary
from app.schemas.pagination import PageQuery
from app.services.inquiries import (
    add_message,
    broadcast_to_participants,
    ensure_inquirable,
    find_workshop_inquiry,
    get_my_inquiry,
    mark_read,
    my_inquiries_select,
    send_participant_inquiry,
    to_inquiry_detail,
    to_inquiry_summaries,
    unread_count,
)
from app.services.pagination import paginate
from app.services.workshops import get_viewable_workshop, lock_workshop

# 参加者から主催者への問い合わせ(やり取りの決まりは services/inquiries.py)
router = APIRouter(tags=["inquiries"])


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
    stmt = my_inquiries_select(current_user, query.workshop_id)
    inquiries = db.scalars(paginate(db, stmt, query, response)).all()
    return to_inquiry_summaries(db, inquiries, current_user)


@router.get("/inquiries/unread-count")
def get_inquiry_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, int]:
    return {"count": unread_count(db, current_user)}


@router.get("/inquiries/{inquiry_id}", response_model=InquiryDetail)
def get_inquiry(
    inquiry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InquiryDetail:
    return to_inquiry_detail(db, get_my_inquiry(db, inquiry_id, current_user), current_user)


@router.post("/inquiries/{inquiry_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_inquiry_read(
    inquiry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    mark_read(db, get_my_inquiry(db, inquiry_id, current_user), current_user)
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
    inquiry = get_my_inquiry(db, inquiry_id, current_user)
    add_message(db, inquiry, current_user, payload.body)
    db.commit()
    db.refresh(inquiry)
    return to_inquiry_detail(db, inquiry, current_user)


@router.get("/workshops/{workshop_id}/inquiry", response_model=InquiryDetail | None)
def get_workshop_inquiry(
    workshop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InquiryDetail | None:
    """このワークショップについて自分が問い合わせたやり取りを返す。まだ問い合わせていなければ null"""
    ensure_inquirable(get_viewable_workshop(db, workshop_id, current_user), current_user)
    inquiry = find_workshop_inquiry(db, workshop_id, current_user.id)
    return None if inquiry is None else to_inquiry_detail(db, inquiry, current_user)


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
    workshop = get_viewable_workshop(db, workshop_id, current_user)
    ensure_inquirable(workshop, current_user)
    inquiry = send_participant_inquiry(db, workshop, current_user, payload.body)
    db.commit()
    db.refresh(inquiry)
    return to_inquiry_detail(db, inquiry, current_user)


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
        raise not_found(WORKSHOP_NOT_FOUND)
    # 全員分をまとめて確定する(途中で失敗したら誰にも届かない)
    sent_count = broadcast_to_participants(db, workshop, current_user, payload.body)
    db.commit()
    return InquiryBroadcastResult(sent_count=sent_count)
