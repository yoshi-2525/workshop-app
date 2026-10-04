from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import exists, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_user, get_current_user_optional, require_roles
from app.core.timeutil import utcnow_naive
from app.database import get_db
from app.models.reservation import Reservation, ReservationStatus
from app.models.user import User, UserRole
from app.models.workshop import Workshop, WorkshopStatus
from app.schemas.reservation import AttendanceUpdate, ReservationCreate, ReservationRead
from app.schemas.workshop import RelatedWorkshops, WorkshopInput, WorkshopRead, WorkshopSearchQuery
from app.services.notifications import add_cancellation_notices, add_reservation_canceled_notice
from app.services.pagination import PageQuery, paginate
from app.services.related import related_workshops
from app.services.reservations import to_reservation_read, to_reservation_reads
from app.services.uploads import delete_workshop_image, save_workshop_image
from app.services.workshops import (
    RESERVATION_DEADLINE_BEFORE,
    check_workshop_input,
    confirmed_tickets_select,
    ensure_editable,
    get_viewable_workshop,
    lock_workshop,
    reservation_deadline,
)
from app.services.workshops import reserved_count as _reserved_count
from app.services.workshops import to_workshop_read as _to_read
from app.services.workshops import to_workshop_reads as _to_reads

router = APIRouter(prefix="/workshops", tags=["workshops"])

# 出欠は開始日時のこの時間前から記録できる(受付の準備や、前日に欠席の連絡を受けた場合のため)。
# フロントエンドの utils/workshop.ts の ATTENDANCE_OPEN_HOURS_BEFORE と揃える
ATTENDANCE_OPEN_BEFORE = timedelta(hours=24)


def _get_owned_workshop(db: Session, workshop_id: int, user: User, *, for_update: bool = False) -> Workshop:
    workshop = lock_workshop(db, workshop_id) if for_update else db.get(Workshop, workshop_id)
    if workshop is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ワークショップが見つかりません")
    if user.role != UserRole.admin and workshop.facilitator_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="この操作を行う権限がありません")
    return workshop


# 公開一覧の並び順。同じ値のときの順序が毎回変わらないよう、最後に id を付ける
_PUBLIC_SORT_ORDERS = {
    "start": (Workshop.start_at.asc(), Workshop.id.asc()),
    "newest": (Workshop.published_at.desc(), Workshop.id.desc()),
    "price": (Workshop.price.asc(), Workshop.start_at.asc(), Workshop.id.asc()),
}


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@router.get("", response_model=list[WorkshopRead])
def list_workshops(
    query: Annotated[WorkshopSearchQuery, Query()],
    response: Response,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> list[WorkshopRead]:
    # 公開中のワークショップだけを検索する(主催者用の一覧は routers/manage.py)。
    # 検索条件の入力チェックは WorkshopSearchQuery で済んでいるので、ここでは SQL を組み立てるだけ
    # 開始済み・終了済みのものは予約できないので、一覧には開催予定(まだ始まっていない)ものだけを出す
    stmt = (
        select(Workshop)
        .where(Workshop.status == WorkshopStatus.published, Workshop.start_at > utcnow_naive())
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
            Workshop.start_at > utcnow_naive() + RESERVATION_DEADLINE_BEFORE,
        )
    # ページネーション時は絞り込み後の総件数をヘッダーで返す
    stmt = paginate(db, stmt, PageQuery(limit=query.limit, offset=query.offset), response)
    workshops = db.scalars(stmt.options(selectinload(Workshop.facilitator))).all()
    return _to_reads(db, workshops, current_user)


@router.get("/{workshop_id}", response_model=WorkshopRead)
def get_workshop(
    workshop_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> WorkshopRead:
    workshop = get_viewable_workshop(db, workshop_id, current_user)
    return _to_read(db, workshop, current_user)


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
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.facilitator)),
) -> WorkshopRead:
    check_workshop_input(db, payload)
    workshop = Workshop(**payload.model_dump(), facilitator_id=current_user.id)
    db.add(workshop)
    db.commit()
    db.refresh(workshop)
    return _to_read(db, workshop, current_user)


@router.put("/{workshop_id}", response_model=WorkshopRead)
def update_workshop(
    workshop_id: int,
    payload: WorkshopInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.facilitator)),
) -> WorkshopRead:
    # 予約の受付と同時に定員・状態を変えても食い違わないよう、行をロックしてから確かめる
    workshop = _get_owned_workshop(db, workshop_id, current_user, for_update=True)
    ensure_editable(workshop)
    check_workshop_input(db, payload, workshop)
    for field, value in payload.model_dump().items():
        setattr(workshop, field, value)
    # 中止への変更と中止の通知は、同じトランザクションでまとめて確定する
    if workshop.status == WorkshopStatus.canceled:
        add_cancellation_notices(db, workshop)
    db.commit()
    db.refresh(workshop)
    return _to_read(db, workshop, current_user)


# 同期 DB セッションとファイル書き込みでイベントループを止めないよう、async にせずスレッドプールで動かす。
# 大きすぎる送信は main.py の BodySizeLimitMiddleware が本文の受け取り中に断る
@router.post("/{workshop_id}/image", response_model=WorkshopRead)
def upload_workshop_image(
    workshop_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.facilitator)),
) -> WorkshopRead:
    # 同時に差し替えられても古い画像を確実に消せるよう、行をロックしてから今の画像を読む
    workshop = _get_owned_workshop(db, workshop_id, current_user, for_update=True)
    ensure_editable(workshop)
    new_image_url = save_workshop_image(file)
    old_image_url = workshop.image_url
    workshop.image_url = new_image_url
    try:
        db.commit()
    except Exception:
        db.rollback()
        # DB に記録できなかった画像はどこからも参照されないので消す
        delete_workshop_image(new_image_url)
        raise
    db.refresh(workshop)
    if old_image_url:
        delete_workshop_image(old_image_url)
    return _to_read(db, workshop, current_user)


@router.delete("/{workshop_id}/image", response_model=WorkshopRead)
def remove_workshop_image(
    workshop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.facilitator)),
) -> WorkshopRead:
    workshop = _get_owned_workshop(db, workshop_id, current_user, for_update=True)
    ensure_editable(workshop)
    old_image_url = workshop.image_url
    workshop.image_url = ""
    db.commit()
    db.refresh(workshop)
    if old_image_url:
        delete_workshop_image(old_image_url)
    return _to_read(db, workshop, current_user)


@router.delete("/{workshop_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workshop(
    workshop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.facilitator)),
) -> None:
    workshop = _get_owned_workshop(db, workshop_id, current_user, for_update=True)
    # 削除できるのは下書きだけ。一度公開したもの(公開中・中止)は、予約の有無や開催前後にかかわらず記録として残す。
    # 削除すると予約・通知も消え、参加者の予約や中止のお知らせが失われるため。
    # 下書きは公開できず予約も受け付けないので、終了日時を過ぎていても削除してよい(編集もできず、消せないと残り続ける)
    if workshop.status == WorkshopStatus.published:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "開催済みのワークショップは、記録として残すため削除できません"
                if workshop.end_at < utcnow_naive()
                else "公開中のワークショップは削除できません。開催を取りやめる場合は中止にしてください"
            ),
        )
    if workshop.status == WorkshopStatus.canceled:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="中止したワークショップは、記録として残すため削除できません",
        )
    image_url = workshop.image_url
    db.delete(workshop)
    db.commit()
    if image_url:
        delete_workshop_image(image_url)


@router.post("/{workshop_id}/reservations", response_model=ReservationRead, status_code=status.HTTP_201_CREATED)
def reserve_workshop(
    workshop_id: int,
    payload: ReservationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReservationRead:
    # 同時に申し込まれても定員を超えないよう、行をロックしてから予約数を数える(commit まで保持)
    workshop = lock_workshop(db, workshop_id)
    if workshop is None or workshop.status != WorkshopStatus.published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ワークショップが見つかりません")
    if utcnow_naive() >= reservation_deadline(workshop.start_at):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="予約の受付は開始日時の24時間前で締め切りました",
        )
    if workshop.facilitator_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="自分が主催するワークショップは予約できません")

    existing = (
        db.query(Reservation)
        .filter(Reservation.workshop_id == workshop_id, Reservation.user_id == current_user.id)
        .first()
    )
    if existing is not None:
        if existing.status == ReservationStatus.confirmed:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="既に予約済みです")
        # キャンセル済みの予約は主催者が取り消したもの。主催者の判断を覆さないよう、再予約させない
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="主催者により参加がキャンセルされたため、このワークショップは予約できません",
        )
    if _reserved_count(db, workshop_id) + payload.ticket_count > workshop.capacity:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="残席がチケット枚数に満たないため予約できません")

    reservation = Reservation(
        workshop_id=workshop_id,
        user_id=current_user.id,
        # 同じアカウントでは同じ名前で参加する想定なので、参加者名はアカウント名を使う
        attendee_name=current_user.name,
        contact=payload.contact,
        ticket_count=payload.ticket_count,
    )
    db.add(reservation)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="既に予約済みです") from exc
    db.refresh(reservation)
    return to_reservation_read(db, reservation, current_user)


@router.get("/{workshop_id}/reservations", response_model=list[ReservationRead])
def list_workshop_reservations(
    workshop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.facilitator)),
) -> list[ReservationRead]:
    _get_owned_workshop(db, workshop_id, current_user)
    reservations = db.scalars(
        select(Reservation)
        .options(
            selectinload(Reservation.user),
            selectinload(Reservation.workshop).selectinload(Workshop.facilitator),
        )
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
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.facilitator)),
) -> ReservationRead:
    # 予約の受付と同時に走っても残席の数が食い違わないよう、予約と同じくワークショップの行をロックする
    workshop = _get_owned_workshop(db, workshop_id, current_user, for_update=True)
    reservation = db.get(Reservation, reservation_id)
    if reservation is None or reservation.workshop_id != workshop.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="予約が見つかりません")
    if reservation.status == ReservationStatus.canceled:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="この予約は既にキャンセルされています")
    if workshop.status == WorkshopStatus.canceled:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="中止したワークショップの予約はキャンセルできません")
    if workshop.start_at <= utcnow_naive():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="開始済みのワークショップの予約はキャンセルできません",
        )

    reservation.status = ReservationStatus.canceled
    # キャンセルと参加者への通知は、同じトランザクションでまとめて確定する
    add_reservation_canceled_notice(db, reservation)
    db.commit()
    db.refresh(reservation)
    return to_reservation_read(db, reservation, current_user)


@router.put("/{workshop_id}/reservations/{reservation_id}/attendance", response_model=ReservationRead)
def update_reservation_attendance(
    workshop_id: int,
    reservation_id: int,
    payload: AttendanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.facilitator)),
) -> ReservationRead:
    """開催当日の出欠を記録する。記録の誤りを直せるよう、開催後も変更できる"""
    workshop = _get_owned_workshop(db, workshop_id, current_user)
    reservation = db.get(Reservation, reservation_id)
    if reservation is None or reservation.workshop_id != workshop.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="予約が見つかりません")
    if workshop.status != WorkshopStatus.published:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="公開中のワークショップだけ出欠を記録できます")
    if reservation.status != ReservationStatus.confirmed:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="キャンセルされた予約の出欠は記録できません")
    if utcnow_naive() < workshop.start_at - ATTENDANCE_OPEN_BEFORE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="出欠は開始日時の24時間前から記録できます",
        )

    reservation.attendance = payload.attendance
    db.commit()
    db.refresh(reservation)
    return to_reservation_read(db, reservation, current_user)
