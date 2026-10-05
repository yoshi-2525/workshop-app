from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_user, get_current_user_optional, require_roles
from app.core.errors import conflict
from app.core.timeutil import utcnow_naive
from app.database import get_db
from app.models.reservation import Reservation
from app.models.user import User, UserRole
from app.models.workshop import Workshop, WorkshopStatus
from app.schemas.reservation import AttendanceUpdate, ReservationCreate, ReservationRead
from app.schemas.workshop import RelatedWorkshops, WorkshopInput, WorkshopRead, WorkshopSearchQuery
from app.services.pagination import paginate
from app.services.related import related_workshops
from app.services.reservations import (
    RESERVATION_LOAD_OPTIONS,
    cancel_reservation,
    create_reservation,
    get_workshop_reservation,
    record_attendance,
    to_reservation_read,
    to_reservation_reads,
)
from app.services.uploads import WORKSHOP_IMAGES, replace_image
from app.services.workshops import (
    cancel_workshop,
    check_workshop_input,
    ensure_editable,
    get_managed_workshop,
    get_viewable_workshop,
    notify_if_first_published,
    public_workshops_select,
    to_workshop_read,
    to_workshop_reads,
)

router = APIRouter(prefix="/workshops", tags=["workshops"])

_manager = require_roles(UserRole.admin, UserRole.facilitator)


@router.get("", response_model=list[WorkshopRead])
def list_workshops(
    query: Annotated[WorkshopSearchQuery, Query()],
    response: Response,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> list[WorkshopRead]:
    # ページネーション時は絞り込み後の総件数をヘッダーで返す
    stmt = paginate(db, public_workshops_select(query, current_user), query, response)
    workshops = db.scalars(stmt.options(selectinload(Workshop.facilitator))).all()
    return to_workshop_reads(db, workshops, current_user)


@router.get("/{workshop_id}", response_model=WorkshopRead)
def get_workshop(
    workshop_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> WorkshopRead:
    workshop = get_viewable_workshop(db, workshop_id, current_user)
    return to_workshop_read(db, workshop, current_user)


@router.get("/{workshop_id}/related", response_model=RelatedWorkshops)
def get_related_workshops(
    workshop_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> RelatedWorkshops:
    """同じ主催者・類似・近くで開催する、開催予定のワークショップ(詳細ページ用)"""
    workshop = get_viewable_workshop(db, workshop_id, current_user)
    return related_workshops(db, workshop, current_user)


@router.post("", response_model=WorkshopRead, status_code=status.HTTP_201_CREATED)
def create_workshop(
    payload: WorkshopInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(_manager),
) -> WorkshopRead:
    check_workshop_input(db, payload)
    workshop = Workshop(**payload.model_dump(), facilitator_id=current_user.id)
    db.add(workshop)
    db.flush()
    # 公開の状態で作成したら、フォロワーへの通知も同じトランザクションで確定する
    notify_if_first_published(db, workshop, was_published=False)
    db.commit()
    db.refresh(workshop)
    return to_workshop_read(db, workshop, current_user)


@router.put("/{workshop_id}", response_model=WorkshopRead)
def update_workshop(
    workshop_id: int,
    payload: WorkshopInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(_manager),
) -> WorkshopRead:
    """内容を更新する。中止は POST /{workshop_id}/cancel で行う"""
    # 予約の受付と同時に定員・状態を変えても食い違わないよう、行をロックしてから確かめる
    workshop = get_managed_workshop(db, workshop_id, current_user, for_update=True)
    ensure_editable(workshop)
    check_workshop_input(db, payload, workshop)
    was_published = workshop.published_at is not None
    for field, value in payload.model_dump().items():
        setattr(workshop, field, value)
    notify_if_first_published(db, workshop, was_published=was_published)
    db.commit()
    db.refresh(workshop)
    return to_workshop_read(db, workshop, current_user)


@router.post("/{workshop_id}/cancel", response_model=WorkshopRead)
def cancel_published_workshop(
    workshop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_manager),
) -> WorkshopRead:
    """公開中のワークショップを中止にする。予約済みの参加者には中止のお知らせが届く。中止は取り消せない"""
    workshop = get_managed_workshop(db, workshop_id, current_user, for_update=True)
    cancel_workshop(db, workshop)
    db.commit()
    db.refresh(workshop)
    return to_workshop_read(db, workshop, current_user)


# 同期 DB セッションとファイル書き込みでイベントループを止めないよう、async にせずスレッドプールで動かす。
# 大きすぎる送信は main.py の BodySizeLimitMiddleware が本文の受け取り中に断る
@router.post("/{workshop_id}/image", response_model=WorkshopRead)
def upload_workshop_image(
    workshop_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(_manager),
) -> WorkshopRead:
    # 同時に差し替えられても古い画像を確実に消せるよう、行をロックしてから今の画像を読む
    workshop = get_managed_workshop(db, workshop_id, current_user, for_update=True)
    ensure_editable(workshop)
    replace_image(db, workshop, "image_url", WORKSHOP_IMAGES, file)
    return to_workshop_read(db, workshop, current_user)


@router.delete("/{workshop_id}/image", response_model=WorkshopRead)
def remove_workshop_image(
    workshop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_manager),
) -> WorkshopRead:
    workshop = get_managed_workshop(db, workshop_id, current_user, for_update=True)
    ensure_editable(workshop)
    replace_image(db, workshop, "image_url", WORKSHOP_IMAGES, None)
    return to_workshop_read(db, workshop, current_user)


@router.delete("/{workshop_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workshop(
    workshop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_manager),
) -> None:
    workshop = get_managed_workshop(db, workshop_id, current_user, for_update=True)
    # 削除できるのは下書きだけ。一度公開したもの(公開中・中止)は、予約の有無や開催前後にかかわらず記録として残す。
    # 削除すると予約・通知も消え、参加者の予約や中止のお知らせが失われるため。
    # 下書きは公開できず予約も受け付けないので、終了日時を過ぎていても削除してよい(編集もできず、消せないと残り続ける)
    if workshop.status == WorkshopStatus.published:
        raise conflict(
            "開催済みのワークショップは、記録として残すため削除できません"
            if workshop.end_at < utcnow_naive()
            else "公開中のワークショップは削除できません。開催を取りやめる場合は中止にしてください"
        )
    if workshop.status == WorkshopStatus.canceled:
        raise conflict("中止したワークショップは、記録として残すため削除できません")
    image_url = workshop.image_url
    db.delete(workshop)
    db.commit()
    if image_url:
        WORKSHOP_IMAGES.delete(image_url)


@router.post("/{workshop_id}/reservations", response_model=ReservationRead, status_code=status.HTTP_201_CREATED)
def reserve_workshop(
    workshop_id: int,
    payload: ReservationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReservationRead:
    reservation = create_reservation(db, workshop_id, current_user, payload)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise conflict("既に予約済みです") from exc
    db.refresh(reservation)
    return to_reservation_read(db, reservation, current_user)


@router.get("/{workshop_id}/reservations", response_model=list[ReservationRead])
def list_workshop_reservations(
    workshop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_manager),
) -> list[ReservationRead]:
    get_managed_workshop(db, workshop_id, current_user)
    reservations = db.scalars(
        select(Reservation)
        .options(*RESERVATION_LOAD_OPTIONS)
        .where(Reservation.workshop_id == workshop_id)
        .order_by(Reservation.created_at.asc(), Reservation.id.asc())
    ).all()
    return to_reservation_reads(db, reservations, current_user)


# 参加者は自分で予約をキャンセルできないので、キャンセルはワークショップの主催者(と運営)が行う
@router.post("/{workshop_id}/reservations/{reservation_id}/cancel", response_model=ReservationRead)
def cancel_workshop_reservation(
    workshop_id: int,
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_manager),
) -> ReservationRead:
    workshop = get_managed_workshop(db, workshop_id, current_user, for_update=True)
    reservation = get_workshop_reservation(db, workshop, reservation_id)
    cancel_reservation(db, workshop, reservation)
    db.commit()
    db.refresh(reservation)
    return to_reservation_read(db, reservation, current_user)


@router.put("/{workshop_id}/reservations/{reservation_id}/attendance", response_model=ReservationRead)
def update_reservation_attendance(
    workshop_id: int,
    reservation_id: int,
    payload: AttendanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_manager),
) -> ReservationRead:
    """開催当日の出欠を記録する。記録の誤りを直せるよう、開催後も変更できる"""
    workshop = get_managed_workshop(db, workshop_id, current_user)
    reservation = get_workshop_reservation(db, workshop, reservation_id)
    record_attendance(workshop, reservation, payload.attendance)
    db.commit()
    db.refresh(reservation)
    return to_reservation_read(db, reservation, current_user)
