"""Seed notifications covering every type / message variant for the notifications page.

通知一覧の確認用の一時的なデータ。参加者 sato@example.com に、通知の全種類・文言の違い
(返金あり・一部返金・返金なし・当日払い)・未読と既読・数分前から1年前までの日時を網羅して入れる。
seed_sample_data.py のワークショップに結び付けるので、そのあとに実行する。
表示の確認用なので、通知の内容とワークショップの状態(予約の有無・中止かどうか)は揃えていない。
確認が済んだら --delete で消す(このスクリプトで入れた通知だけを消す)。

Usage:
    ./venv/Scripts/python scripts/seed_sample_notifications.py           # 投入
    ./venv/Scripts/python scripts/seed_sample_notifications.py --delete  # 削除
"""

import argparse
import sys
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path
from types import SimpleNamespace

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.timeutil import utcnow_naive  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models.notification import Notification, NotificationType  # noqa: E402
from app.models.reservation import CancelReason  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.workshop import Workshop  # noqa: E402
from app.services.notifications import (  # noqa: E402
    _add_missing,
    add_payment_refund_failed_notice,
    add_payment_refunded_notice,
    add_reservation_canceled_notice,
    reminder_message,
)

USER_EMAIL = "sato@example.com"


@dataclass(frozen=True)
class SampleNotice:
    type: NotificationType
    workshop_title: str
    # 何分前に届いたことにするか
    minutes_ago: int
    is_read: bool
    # 主催者による参加のキャンセル・中止での返金の扱い
    refund_amount: int | None = None
    reason: CancelReason | None = None


DAY = 24 * 60

# 新しい順。未読は上の4件
NOTICES = [
    SampleNotice(NotificationType.reminder, "夜のカフェで、大人の付き合いについて考える対話会", 10, False),
    SampleNotice(NotificationType.new_workshop, "答えを急がず、問いを深める哲学対話の夜", 2 * 60, False),
    # 主催者の都合による取消(全額返金)
    SampleNotice(
        NotificationType.reservation_canceled,
        "仕事帰りに、働くことの意味について対話しませんか？",
        DAY,
        False,
        refund_amount=1500,
        reason=CancelReason.facilitator,
    ),
    SampleNotice(NotificationType.payment_refund_failed, "映画をきっかけに、「正しさ」について深く考える対話会", 2 * DAY, False),
    # 中止(オンライン決済の全額返金あり)と、その返金の完了
    SampleNotice(NotificationType.cancellation, "東京で働き、暮らすことの豊かさと虚しさについて考える会", 3 * DAY, True, refund_amount=1000),
    SampleNotice(NotificationType.payment_refunded, "東京で働き、暮らすことの豊かさと虚しさについて考える会", 3 * DAY - 30, True, refund_amount=1000),
    # 参加者都合による取消(手数料を差し引いて一部返金)
    SampleNotice(
        NotificationType.reservation_canceled,
        "小説から広がる「幸せな人生」についての対話会",
        7 * DAY,
        True,
        refund_amount=1180,
        reason=CancelReason.participant,
    ),
    # 参加者都合による取消(手数料を差し引くと返金額が残らない)
    SampleNotice(
        NotificationType.reservation_canceled,
        "SNS時代の幸せと他人との比較について語り合いませんか？",
        14 * DAY,
        True,
        refund_amount=0,
        reason=CancelReason.participant,
    ),
    # 当日払いの取消(返金の文言なし)
    SampleNotice(NotificationType.reservation_canceled, "表面的な会話から一歩踏み込み、本音の対話を実践する場", 21 * DAY, True),
    # 当日払いの中止(返金の文言なし)
    SampleNotice(NotificationType.cancellation, "静かなBARで「飲み会の楽しさ」について考える会", 30 * DAY, True),
    SampleNotice(NotificationType.new_workshop, "美しいと感じる心について、夜のカフェで語り合いませんか？", 60 * DAY, True),
    SampleNotice(NotificationType.reminder, "人とつながること、孤独であることについて語り合う夜", 365 * DAY, True),
]


def _add(db, user: User, workshop: Workshop, notice: SampleNotice) -> None:
    """種類ごとに、実際に通知を送るときと同じ文言で追加する"""
    # 予約を受け取る関数には、使う項目だけを持たせた代わりのものを渡す
    reservation = SimpleNamespace(workshop=workshop, workshop_id=workshop.id, user_id=user.id)
    if notice.type == NotificationType.reservation_canceled:
        add_reservation_canceled_notice(db, reservation, refund_amount=notice.refund_amount, reason=notice.reason)
    elif notice.type == NotificationType.payment_refunded:
        add_payment_refunded_notice(db, reservation, notice.refund_amount)
    elif notice.type == NotificationType.payment_refund_failed:
        add_payment_refund_failed_notice(db, reservation)
    elif notice.type == NotificationType.reminder:
        _add_missing(db, workshop.id, [user.id], notice.type, reminder_message(workshop))
    elif notice.type == NotificationType.cancellation:
        # add_cancellation_notices は予約が確定した参加者全員に送るので、同じ文言で1人にだけ送る
        message = f"「{workshop.title}」は主催者により中止になりました。"
        if notice.refund_amount is not None:
            message += "オンラインでお支払いいただいた参加費は全額返金します。"
        _add_missing(db, workshop.id, [user.id], notice.type, message)
    elif notice.type == NotificationType.new_workshop:
        # add_new_workshop_notices はフォロワー全員に送るので、同じ文言で1人にだけ送る
        message = (
            f"フォロー中の{workshop.facilitator.name}さんが、新しいワークショップ「{workshop.title}」を公開しました。"
        )
        _add_missing(db, workshop.id, [user.id], notice.type, message)


def _find(db, user: User, workshop: Workshop, type_: NotificationType) -> Notification | None:
    return (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.workshop_id == workshop.id, Notification.type == type_)
        .first()
    )


def _load(db) -> tuple[User, dict[str, Workshop]]:
    user = db.query(User).filter(User.email == USER_EMAIL).first()
    titles = {n.workshop_title for n in NOTICES}
    workshops = {w.title: w for w in db.query(Workshop).filter(Workshop.title.in_(titles))}
    missing = titles - workshops.keys()
    if user is None or missing:
        sys.exit("サンプルデータが見つかりません。先に scripts/seed_sample_data.py を実行してください。")
    return user, workshops


def seed() -> None:
    db = SessionLocal()
    try:
        user, workshops = _load(db)
        now = utcnow_naive()
        added = 0
        for notice in NOTICES:
            workshop = workshops[notice.workshop_title]
            if _find(db, user, workshop, notice.type) is not None:
                continue
            _add(db, user, workshop, notice)
            db.flush()
            notification = _find(db, user, workshop, notice.type)
            notification.created_at = now - timedelta(minutes=notice.minutes_ago)
            notification.is_read = notice.is_read
            added += 1
        db.commit()
        print(f"{USER_EMAIL} に通知を {added} 件追加しました(全 {len(NOTICES)} 件。既にあるものは飛ばしました)。")
    finally:
        db.close()


def delete() -> None:
    db = SessionLocal()
    try:
        user, workshops = _load(db)
        deleted = 0
        for notice in NOTICES:
            notification = _find(db, user, workshops[notice.workshop_title], notice.type)
            if notification is not None:
                db.delete(notification)
                deleted += 1
        db.commit()
        print(f"{USER_EMAIL} の通知を {deleted} 件削除しました。")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--delete", action="store_true", help="このスクリプトで入れた通知を消す")
    args = parser.parse_args()
    delete() if args.delete else seed()
