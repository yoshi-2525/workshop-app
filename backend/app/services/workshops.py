from collections.abc import Sequence

from fastapi import HTTPException, status
from sqlalchemy import ColumnElement, Select, exists, func, select
from sqlalchemy.orm import Session

from app.core.timeutil import utcnow_naive
from app.models.favorite import Favorite
from app.models.reservation import Reservation, ReservationStatus
from app.models.user import User, UserRole
from app.models.workshop import Workshop, WorkshopStatus
from app.schemas.workshop import WorkshopInput, WorkshopRead, WorkshopViewer


def lock_workshop(db: Session, workshop_id: int) -> Workshop | None:
    """ワークショップの行をロックして取得する(SELECT ... FOR UPDATE)。

    予約の定員チェックと、定員・状態の変更が同時に走っても食い違わないよう、
    予約数を数える前にこれで取得する。ロックは commit / rollback で外れる。
    """
    stmt = select(Workshop).where(Workshop.id == workshop_id).with_for_update()
    return db.execute(stmt).scalar_one_or_none()


def _conflict(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


def ensure_editable(workshop: Workshop) -> None:
    """内容・画像を変更してよい状態かを確かめる"""
    # 中止は取り消せない。参加者には中止の通知が届いており、再開すると予約・通知と食い違うため
    if workshop.status == WorkshopStatus.canceled:
        raise _conflict("中止したワークショップは編集できません")
    # 開催済み(終了日時を過ぎた)ものは変更させない。管理画面の「開催履歴」と同じく終了日時で判定する
    if workshop.end_at < utcnow_naive():
        raise _conflict("開催済みのワークショップは編集できません")


def check_workshop_input(db: Session, payload: WorkshopInput, workshop: Workshop | None = None) -> None:
    """作成(workshop=None)・更新の内容が、ワークショップの状態と予約に照らして許されるかを確かめる。

    更新時は ensure_editable を通した、lock_workshop で取得したワークショップを渡すこと(予約数を数えるため)。
    """
    now = utcnow_naive()

    if workshop is None:
        if payload.status == WorkshopStatus.canceled:
            raise _conflict("中止の状態でワークショップを作成することはできません")
        if payload.start_at < now:
            raise _conflict("開始日時には現在より後の日時を指定してください")
        return

    # 開催中のものは開始日時をそのままにして他の項目を直せるよう、変更したときだけ確かめる
    if payload.start_at != workshop.start_at and payload.start_at < now:
        raise _conflict("開始日時には現在より後の日時を指定してください")

    # 一度公開したものは、予約の有無にかかわらず下書きに戻させない(参加者の目に触れているため)
    if workshop.status == WorkshopStatus.published and payload.status == WorkshopStatus.draft:
        raise _conflict("公開済みのワークショップは下書きに戻せません。開催を取りやめる場合は中止にしてください")

    # 下書きは参加者の目に触れておらず予約もないので、中止ではなく削除してもらう
    if workshop.status == WorkshopStatus.draft and payload.status == WorkshopStatus.canceled:
        raise _conflict("下書きのワークショップは中止できません。取りやめる場合は削除してください")

    booked = reserved_count(db, workshop.id)
    if payload.capacity < booked:
        raise _conflict(f"定員は予約済みのチケット枚数({booked}枚)以上にしてください")


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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ワークショップが見つかりません")
    is_owner = user is not None and (user.role == UserRole.admin or user.id == workshop.facilitator_id)
    # Participants keep access to a canceled workshop they booked, so links from
    # the cancellation notice and their reservation list still resolve.
    had_reservation = (
        workshop.status == WorkshopStatus.canceled
        and user is not None
        and _has_reservation(db, workshop_id, user.id)
    )
    if workshop.status != WorkshopStatus.published and not (is_owner or had_reservation):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ワークショップが見つかりません")
    return workshop
