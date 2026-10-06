from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.pagination import PageQuery
from app.schemas.payment import BankAccountInput, BankAccountRead, EarningRead, PayoutRequestRead, PayoutSummary
from app.services.pagination import paginate
from app.services.payouts import (
    earnings_select,
    my_payout_requests_select,
    request_payout,
    to_bank_account_read,
    to_earning_reads,
    to_payout_request_reads,
    to_payout_summary,
    upsert_bank_account,
)

# 主催者が自分の売上を確かめ、振込を申請するための API
router = APIRouter(prefix="/facilitators/me/payouts", tags=["payouts"])

_manager = require_roles(UserRole.admin, UserRole.facilitator)


@router.get("/summary", response_model=PayoutSummary)
def get_payout_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(_manager),
) -> PayoutSummary:
    """振込を申請できる額・開催前の額・申請中の額・振込済みの額と、いま申請できるか"""
    return to_payout_summary(db, current_user)


@router.get("/earnings", response_model=list[EarningRead])
def list_earnings(
    page: Annotated[PageQuery, Query()],
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(_manager),
) -> list[EarningRead]:
    """自分のワークショップで支払われたオンライン決済の明細。返金になったものも含め、終了日時の新しい順"""
    stmt = paginate(db, earnings_select(current_user), page, response)
    return to_earning_reads(list(db.scalars(stmt).all()))


@router.get("/bank-account", response_model=BankAccountRead | None)
def get_bank_account(current_user: User = Depends(_manager)) -> BankAccountRead | None:
    """登録している振込先口座。未登録なら null"""
    account = current_user.payout_bank_account
    return to_bank_account_read(account) if account is not None else None


@router.put("/bank-account", response_model=BankAccountRead)
def put_bank_account(
    payload: BankAccountInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(_manager),
) -> BankAccountRead:
    """振込先口座を登録・変更する。申請中の振込は、申請したときの口座へ振り込まれる"""
    account = upsert_bank_account(db, current_user, payload)
    db.commit()
    db.refresh(account)
    return to_bank_account_read(account)


@router.get("/requests", response_model=list[PayoutRequestRead])
def list_my_payout_requests(
    page: Annotated[PageQuery, Query()],
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(_manager),
) -> list[PayoutRequestRead]:
    """自分の振込の申請の履歴。新しい順"""
    stmt = paginate(db, my_payout_requests_select(current_user), page, response)
    return to_payout_request_reads(list(db.scalars(stmt).all()))


@router.post("/requests", response_model=PayoutRequestRead, status_code=status.HTTP_201_CREATED)
def create_payout_request(
    db: Session = Depends(get_db),
    current_user: User = Depends(_manager),
) -> PayoutRequestRead:
    """申請できる額の全額で振込を申請する。振込手数料を差し引いた額が、登録している口座へ振り込まれる。

    申請中のものがある間は、新しく申請できない
    """
    request = request_payout(db, current_user)
    db.commit()
    db.refresh(request)
    return to_payout_request_reads([request])[0]
