from collections.abc import Sequence
from datetime import datetime, timedelta

from sqlalchemy import ColumnElement, Select, exists, func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import WORKSHOP_NOT_FOUND, conflict, forbidden, not_found
from app.core.timeutil import utcnow_naive
from app.models.favorite import Favorite
from app.models.reservation import Reservation, ReservationStatus
from app.models.user import User, UserRole
from app.models.workshop import Workshop, WorkshopStatus
from app.schemas.workshop import (
    ParticipantInfo,
    WorkshopInput,
    WorkshopRead,
    WorkshopSearchQuery,
    WorkshopViewer,
)
from app.services.notifications import (
    add_cancellation_notices,
    add_new_workshop_notices,
    remove_new_workshop_notices,
)


# 予約の締め切り。開始日時のこの時間前を過ぎたら予約を受け付けない。
# フロントエンドの utils/workshop.ts の RESERVATION_DEADLINE_HOURS_BEFORE と揃える
RESERVATION_DEADLINE_BEFORE = timedelta(hours=24)


def reservation_deadline(start_at: datetime) -> datetime:
    """予約の締め切り日時(この日時以降は予約できない)"""
    return start_at - RESERVATION_DEADLINE_BEFORE


def lock_workshop(db: Session, workshop_id: int) -> Workshop | None:
    """ワークショップの行をロックして取得する(SELECT ... FOR UPDATE)。

    予約の定員チェックと、定員・状態の変更が同時に走っても食い違わないよう、
    予約数を数える前にこれで取得する。ロックは commit / rollback で外れる。
    """
    stmt = select(Workshop).where(Workshop.id == workshop_id).with_for_update()
    return db.execute(stmt).scalar_one_or_none()


def can_manage(user: User | None, workshop: Workshop) -> bool:
    """ワークショップを管理できるか(運営か、そのワークショップの主催者本人)"""
    return user is not None and (user.role == UserRole.admin or workshop.facilitator_id == user.id)


def get_managed_workshop(db: Session, workshop_id: int, user: User, *, for_update: bool = False) -> Workshop:
    """管理する(編集・予約の管理などをする)ワークショップを取得する。

    for_update=True なら lock_workshop と同じく行をロックする。存在しなければ 404、管理できなければ 403
    """
    workshop = lock_workshop(db, workshop_id) if for_update else db.get(Workshop, workshop_id)
    if workshop is None:
        raise not_found(WORKSHOP_NOT_FOUND)
    if not can_manage(user, workshop):
        raise forbidden()
    return workshop


def ensure_editable(workshop: Workshop) -> None:
    """内容・画像を変更してよい状態かを確かめる"""
    # 中止は取り消せない。参加者には中止の通知が届いており、再開すると予約・通知と食い違うため
    if workshop.status == WorkshopStatus.canceled:
        raise conflict("中止したワークショップは編集できません")
    # 開催済み(終了日時を過ぎた)ものは変更させない。管理画面の「開催履歴」と同じく終了日時で判定する
    if workshop.end_at < utcnow_naive():
        raise conflict("開催済みのワークショップは編集できません")


def check_workshop_input(db: Session, payload: WorkshopInput, workshop: Workshop | None = None) -> None:
    """作成(workshop=None)・更新の内容が、ワークショップの状態と予約に照らして許されるかを確かめる。

    更新時は ensure_editable を通した、lock_workshop で取得したワークショップを渡すこと(予約数を数えるため)。
    """
    now = utcnow_naive()

    # 中止は、参加者への通知を伴う別の操作(cancel_workshop)で行う
    if payload.status == WorkshopStatus.canceled:
        raise conflict(
            "中止の状態でワークショップを作成することはできません"
            if workshop is None
            else "ワークショップを中止するには、編集画面の「中止する」を使ってください"
        )

    if workshop is None:
        if payload.start_at < now:
            raise conflict("開始日時には現在より後の日時を指定してください")
        return

    # 開催中のものは開始日時をそのままにして他の項目を直せるよう、変更したときだけ確かめる。
    # ただし新たに公開するときは、開始済みのまま公開しないよう変更の有無にかかわらず確かめる
    is_publishing = workshop.status != WorkshopStatus.published and payload.status == WorkshopStatus.published
    if (is_publishing or payload.start_at != workshop.start_at) and payload.start_at < now:
        raise conflict("開始日時には現在より後の日時を指定してください")
    # 終了日時を過去にすると、編集で「開催済み」にできてしまう
    if payload.end_at != workshop.end_at and payload.end_at < now:
        raise conflict("終了日時には現在より後の日時を指定してください")

    # 一度公開したものは、予約の有無にかかわらず下書きに戻させない(参加者の目に触れているため)
    if workshop.status == WorkshopStatus.published and payload.status == WorkshopStatus.draft:
        raise conflict("公開済みのワークショップは下書きに戻せません。開催を取りやめる場合は中止にしてください")

    # 公開中のものは、参加者が予約したときの条件(参加費・日時・場所)を変えさせない
    if workshop.status == WorkshopStatus.published:
        changed = [
            label
            for label, new, old in (
                ("参加費", payload.price, workshop.price),
                ("開始日時", payload.start_at, workshop.start_at),
                ("終了日時", payload.end_at, workshop.end_at),
                ("開催形式", payload.location_type, workshop.location_type),
                ("場所", payload.location, workshop.location),
            )
            if new != old
        ]
        if changed:
            raise conflict(f"公開中のワークショップは{'・'.join(changed)}を変更できません")

    # 定員は、すでに予約されているチケット枚数(参加人数)を下回らせない
    booked = reserved_count(db, workshop.id)
    if payload.capacity < booked:
        raise conflict(f"定員は予約済みのチケット枚数({booked}枚)以上にしてください")


def cancel_workshop(db: Session, workshop: Workshop) -> None:
    """公開中のワークショップを中止にし、予約済みの参加者に通知する(commit は呼び出し側)。

    中止への変更と中止の通知は、同じトランザクションでまとめて確定する。
    予約の受付と同時に走っても通知の対象が食い違わないよう、workshop は lock_workshop で取得したものを渡すこと
    """
    ensure_editable(workshop)
    # 下書きは参加者の目に触れておらず予約もないので、中止ではなく削除してもらう
    if workshop.status == WorkshopStatus.draft:
        raise conflict("下書きのワークショップは中止できません。取りやめる場合は削除してください")
    workshop.status = WorkshopStatus.canceled
    add_cancellation_notices(db, workshop)
    remove_new_workshop_notices(db, workshop)


def notify_if_first_published(db: Session, workshop: Workshop, *, was_published: bool) -> None:
    """初めて公開したときだけ、主催者のフォロワーに通知する(commit は呼び出し側)。

    was_published には、変更前に一度でも公開したことがあったか(published_at があったか)を渡す。
    公開済みのものは下書きに戻せないので、同じワークショップで二度通知することはない。
    新規作成のときは id が決まっているよう、flush してから呼ぶこと
    """
    if not was_published and workshop.status == WorkshopStatus.published:
        add_new_workshop_notices(db, workshop)


# 公開一覧の並び順。同じ値のときの順序が毎回変わらないよう、最後に id を付ける
_PUBLIC_SORT_ORDERS = {
    "start": (Workshop.start_at.asc(), Workshop.id.asc()),
    "newest": (Workshop.published_at.desc(), Workshop.id.desc()),
    "price": (Workshop.price.asc(), Workshop.start_at.asc(), Workshop.id.asc()),
}


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def public_workshops_select(query: WorkshopSearchQuery, current_user: User | None) -> Select[tuple[Workshop]]:
    """公開一覧(GET /api/workshops)の検索条件から SELECT を組み立てる。

    公開中のワークショップだけを対象にする(主催者用の一覧は routers/manage.py)。
    開始済み・終了済みのものは予約できないので、開催予定(まだ始まっていない)ものだけを出す。
    検索条件の入力チェックは WorkshopSearchQuery で済んでいるので、ここでは SQL を組み立てるだけ
    """
    now = utcnow_naive()
    stmt = (
        select(Workshop)
        .where(Workshop.status == WorkshopStatus.published, Workshop.start_at > now)
        .order_by(*_PUBLIC_SORT_ORDERS[query.sort])
    )
    if query.facilitator_id is not None:
        stmt = stmt.where(Workshop.facilitator_id == query.facilitator_id)
    keyword = query.q.strip() if query.q else ""
    if keyword:
        pattern = f"%{_escape_like(keyword)}%"
        stmt = stmt.where(
            or_(
                Workshop.title.ilike(pattern, escape="\\"),
                Workshop.description.ilike(pattern, escape="\\"),
            )
        )
    if query.location_type is not None:
        stmt = stmt.where(Workshop.location_type == query.location_type)
    if query.price == "free":
        stmt = stmt.where(Workshop.price == 0)
    elif query.price == "paid":
        stmt = stmt.where(Workshop.price > 0)
        if query.max_price is not None:
            stmt = stmt.where(Workshop.price <= query.max_price)
    if query.start_from is not None:
        stmt = stmt.where(Workshop.start_at >= query.start_from)
    if query.start_to is not None:
        stmt = stmt.where(Workshop.start_at < query.start_to)
    if query.exclude_reserved and current_user is not None:
        stmt = stmt.where(
            ~exists().where(
                Reservation.workshop_id == Workshop.id,
                Reservation.user_id == current_user.id,
                Reservation.status == ReservationStatus.confirmed,
            )
        )
    if query.exclude_own and current_user is not None:
        stmt = stmt.where(Workshop.facilitator_id != current_user.id)
    if query.available:
        # 確定済みチケットの合計が定員に達していない(満員でない)ものだけ
        booked = (
            confirmed_tickets_select(Reservation.workshop_id == Workshop.id)
            .correlate(Workshop)
            .scalar_subquery()
        )
        # 予約の締め切りを過ぎたものも、チケットを購入できないので除く
        stmt = stmt.where(
            booked < Workshop.capacity,
            Workshop.start_at > now + RESERVATION_DEADLINE_BEFORE,
        )
    return stmt


def confirmed_tickets_select(*criteria: ColumnElement[bool]) -> Select[tuple[int]]:
    """確定済みチケットの合計を求める SELECT。予約数(定員に対する埋まり具合)の定義はここだけに置く。

    criteria で対象の予約を絞る。ワークショップごとに集計するときは
    .add_columns(Reservation.workshop_id).group_by(Reservation.workshop_id) を付ける。
    """
    return select(func.coalesce(func.sum(Reservation.ticket_count), 0)).where(
        Reservation.status == ReservationStatus.confirmed, *criteria
    )


def reserved_count(db: Session, workshop_id: int) -> int:
    return db.scalar(confirmed_tickets_select(Reservation.workshop_id == workshop_id)) or 0


def _can_see_participant_info(workshop: Workshop, user: User | None, reserved_ids: set[int]) -> bool:
    """参加者向けの案内(当日の詳細・緊急連絡先)を見せてよいか。予約が確定している参加者と主催者・運営だけ"""
    return can_manage(user, workshop) or workshop.id in reserved_ids


def to_workshop_reads(
    db: Session, workshops: Sequence[Workshop], current_user: User | None = None
) -> list[WorkshopRead]:
    """複数件をまとめて変換する。件数に関係なく、SQL は最大3回(予約人数・お気に入り・予約済み)。

    主催者名は workshop.facilitator を参照するので、呼び出し側で
    selectinload(Workshop.facilitator) しておくと 1件ずつの読み込みを避けられる。
    """
    ids = {w.id for w in workshops}
    if not ids:
        return []

    counts = {
        workshop_id: total
        for total, workshop_id in db.execute(
            confirmed_tickets_select(Reservation.workshop_id.in_(ids))
            .add_columns(Reservation.workshop_id)
            .group_by(Reservation.workshop_id)
        ).all()
    }

    favorited_ids: set[int] = set()
    reserved_ids: set[int] = set()
    canceled_ids: set[int] = set()
    if current_user is not None:
        favorited_ids = set(
            db.scalars(
                select(Favorite.workshop_id).where(
                    Favorite.user_id == current_user.id,
                    Favorite.workshop_id.in_(ids),
                )
            )
        )
        # 予約は1人1ワークショップ1件なので、状態ごとに振り分ける
        for workshop_id, reservation_status in db.execute(
            select(Reservation.workshop_id, Reservation.status).where(
                Reservation.user_id == current_user.id,
                Reservation.workshop_id.in_(ids),
            )
        ).all():
            if reservation_status == ReservationStatus.confirmed:
                reserved_ids.add(workshop_id)
            else:
                canceled_ids.add(workshop_id)

    return [
        WorkshopRead(
            id=w.id,
            title=w.title,
            description=w.description,
            image_url=w.image_url,
            location_type=w.location_type,
            location=w.location,
            start_at=w.start_at,
            end_at=w.end_at,
            capacity=w.capacity,
            price=w.price,
            cancellation_policy=w.cancellation_policy,
            status=w.status,
            facilitator_id=w.facilitator_id,
            facilitator_name=w.facilitator.name,
            facilitator_avatar_url=w.facilitator.avatar_url,
            reserved_count=int(counts.get(w.id, 0)),
            viewer=WorkshopViewer(
                is_favorited=w.id in favorited_ids,
                is_reserved=w.id in reserved_ids,
                is_reservation_canceled=w.id in canceled_ids,
            ),
            participant_info=(
                ParticipantInfo(guide=w.participant_guide, emergency_contact=w.emergency_contact)
                if _can_see_participant_info(w, current_user, reserved_ids)
                else None
            ),
        )
        for w in workshops
    ]


def to_workshop_read(db: Session, workshop: Workshop, current_user: User | None = None) -> WorkshopRead:
    return to_workshop_reads(db, [workshop], current_user)[0]


def _has_reservation(db: Session, workshop_id: int, user_id: int) -> bool:
    stmt = select(
        exists().where(Reservation.workshop_id == workshop_id, Reservation.user_id == user_id)
    )
    return bool(db.scalar(stmt))


def get_viewable_workshop(db: Session, workshop_id: int, user: User | None) -> Workshop:
    """詳細ページを見てよいワークショップを取得する。見られないものは存在しないのと同じく 404 にする"""
    workshop = db.get(Workshop, workshop_id)
    if workshop is None:
        raise not_found(WORKSHOP_NOT_FOUND)
    # 中止になったワークショップも、予約していた参加者は見られるようにする
    # (中止のお知らせや予約一覧からのリンクが切れないように)
    had_reservation = (
        workshop.status == WorkshopStatus.canceled
        and user is not None
        and _has_reservation(db, workshop_id, user.id)
    )
    if workshop.status != WorkshopStatus.published and not (can_manage(user, workshop) or had_reservation):
        raise not_found(WORKSHOP_NOT_FOUND)
    return workshop
