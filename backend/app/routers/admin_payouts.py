from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.payment import AdminPayoutRequestRead, PayoutPaidInput, PayoutRejectInput, PayoutRequestQuery
from app.services.pagination import paginate
from app.services.payouts import (
    admin_payout_requests_select,
    get_open_payout_request,
    mark_payout_paid,
    reject_payout,
    to_admin_payout_request_reads,
)

# 運営が主催者からの振込の申請を処理するための API
router = APIRouter(prefix="/admin/payout-requests", tags=["admin"])

_admin = require_roles(UserRole.admin)


@router.get("", response_model=list[AdminPayoutRequestRead])
def list_payout_requests(
    query: Annotated[PayoutRequestQuery, Query()],
    response: Response,
    db: Session = Depends(get_db),
    _: User = Depends(_admin),
) -> list[AdminPayoutRequestRead]:
    """振込の申請の一覧。status で絞り込める。申請の古い順"""
    stmt = paginate(db, admin_payout_requests_select(query), query, response)
    return to_admin_payout_request_reads(list(db.scalars(stmt).all()))


@router.post("/{request_id}/paid", response_model=AdminPayoutRequestRead)
def mark_paid(
    request_id: int,
    payload: PayoutPaidInput,
    db: Session = Depends(get_db),
    _: User = Depends(_admin),
) -> AdminPayoutRequestRead:
    """銀行で振り込んだ後に、申請を振込済みにする。取り消せない"""
    request = get_open_payout_request(db, request_id)
    mark_payout_paid(request, payload.note)
    db.commit()
    db.refresh(request)
    return to_admin_payout_request_reads([request])[0]


@router.post("/{request_id}/reject", response_model=AdminPayoutRequestRead)
def reject(
    request_id: int,
    payload: PayoutRejectInput,
    db: Session = Depends(get_db),
    _: User = Depends(_admin),
) -> AdminPayoutRequestRead:
    """振り込まずに申請を取り下げる(口座の誤りなど)。理由は必須で、主催者に表示される。申請額は主催者の申請できる額に戻る。取り消せない"""
    request = get_open_payout_request(db, request_id)
    reject_payout(request, payload.note)
    db.commit()
    db.refresh(request)
    return to_admin_payout_request_reads([request])[0]
