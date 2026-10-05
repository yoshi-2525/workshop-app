import logging

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.core import stripe_client
from app.core.errors import bad_request, service_unavailable
from app.database import get_db
from app.models.stripe_event import StripeEvent
from app.services.stripe_webhooks import handle_stripe_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stripe", tags=["stripe"])


def _process(db: Session, event: dict) -> None:
    try:
        handle_stripe_event(db, event)
        db.commit()
    except IntegrityError:
        db.rollback()
        # 同じイベントが同時に届き、もう一方が先に記録した場合だけ、処理済みとして扱う。
        # それ以外の制約違反は反映できていないので、5xx にして Stripe に再送してもらう
        if db.get(StripeEvent, event["id"]) is None:
            logger.exception("Stripe のイベントを反映できませんでした (%s)", event["id"])
            raise


@router.post("/webhook", status_code=status.HTTP_204_NO_CONTENT)
async def receive_stripe_webhook(request: Request, db: Session = Depends(get_db)) -> None:
    """Stripe からの通知(Webhook)。決済の完了・期限切れと、主催者の連結アカウントの状態の変化を反映する。

    認証の代わりに Stripe の署名を確かめる。署名は受け取ったままの本文で計算されるので、
    本文を読むために例外として async にし、DB の処理はスレッドプールで行う。
    反映に失敗したら 5xx を返し、Stripe に再送してもらう
    """
    payload = await request.body()
    try:
        event = stripe_client.construct_event(payload, request.headers.get("stripe-signature"))
    except ValueError as exc:
        raise bad_request("署名を確かめられませんでした") from exc
    try:
        await run_in_threadpool(_process, db, event)
    except stripe_client.StripeUnavailable as exc:
        raise service_unavailable("時間をおいて再送してください") from exc
