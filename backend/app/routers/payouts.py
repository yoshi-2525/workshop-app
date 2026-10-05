from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.payment import PayoutAccountRead, RedirectUrl
from app.services.payments import (
    payout_dashboard_url,
    start_payout_onboarding,
    sync_payout_account,
    to_payout_account_read,
)

router = APIRouter(prefix="/facilitators/me/payout-account", tags=["payouts"])

_manager = require_roles(UserRole.admin, UserRole.facilitator)


@router.get("", response_model=PayoutAccountRead)
def get_payout_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(_manager),
) -> PayoutAccountRead:
    """参加費の受け取り設定の状態。設定の途中・審査中なら Stripe から最新の状態を読み直す"""
    sync_payout_account(db, current_user)
    db.commit()
    return to_payout_account_read(current_user)


@router.post("/onboarding", response_model=RedirectUrl)
def begin_payout_onboarding(
    db: Session = Depends(get_db),
    current_user: User = Depends(_manager),
) -> RedirectUrl:
    """受け取り設定(本人確認・口座登録)を行う Stripe の画面の URL を返す。初回は Stripe の連結アカウントを作る。

    アカウントの作成は service の中で確定する(画面の URL の作成に失敗しても、作ったアカウントを失わないため)
    """
    return RedirectUrl(url=start_payout_onboarding(db, current_user))


@router.post("/dashboard", response_model=RedirectUrl)
def open_payout_dashboard(current_user: User = Depends(_manager)) -> RedirectUrl:
    """売上・入金を確認する Stripe のダッシュボードの URL を返す。受け取り設定が完了している場合だけ"""
    return RedirectUrl(url=payout_dashboard_url(current_user))
