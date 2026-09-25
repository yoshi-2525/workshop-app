from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import exists, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_current_user_optional, require_roles
from app.database import get_db
from app.models.favorite import Favorite
from app.models.reservation import Reservation, ReservationStatus
from app.models.user import User, UserRole
from app.models.workshop import LocationType, Workshop, WorkshopStatus
from app.schemas.reservation import ReservationCreate, ReservationRead
from app.schemas.workshop import WorkshopInput, WorkshopRead
from app.services.notifications import notify_workshop_canceled
from app.services.uploads import delete_workshop_image, save_workshop_image
from app.services.workshops import reserved_count as _reserved_count
from app.services.workshops import to_workshop_read as _to_read

router = APIRouter(prefix="/workshops", tags=["workshops"])


def _get_owned_workshop(db: Session, workshop_id: int, user: User) -> Workshop:
    workshop = db.get(Workshop, workshop_id)
    if workshop is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ワークショップが見つかりません")
    if user.role != UserRole.admin and workshop.facilitator_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="この操作を行う権限がありません")
    return workshop


def _has_reservation(db: Session, workshop_id: int, user_id: int) -> bool:
    stmt = select(
        exists().where(Reservation.workshop_id == workshop_id, Reservation.user_id == user_id)
    )
    return bool(db.scalar(stmt))


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@router.get("", response_model=list[WorkshopRead])
def list_workshops(
    mine: bool = Query(False),
    facilitator_id: int | None = Query(None),
    q: str | None = Query(None, max_length=100),
    location_type: LocationType | None = Query(None),
    price: Literal["free", "paid"] | None = Query(None),
    max_price: int | None = Query(None, ge=0),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> list[WorkshopRead]:
    if mine:
        if current_user is None or current_user.role not in (UserRole.admin, UserRole.facilitator):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="この操作を行う権限がありません")
        stmt = select(Workshop).order_by(Workshop.start_at.desc())
        if current_user.role != UserRole.admin:
            stmt = stmt.where(Workshop.facilitator_id == current_user.id)
    else:
        stmt = (
            select(Workshop)
            .where(Workshop.status == WorkshopStatus.published)
            .order_by(Workshop.start_at.asc())
        )
        if facilitator_id is not None:
            stmt = stmt.where(Workshop.facilitator_id == facilitator_id)
        keyword = q.strip() if q else ""
        if keyword:
            pattern = f"%{_escape_like(keyword)}%"
            stmt = stmt.where(
                or_(
                    Workshop.title.ilike(pattern, escape="\\"),
                    Workshop.description.ilike(pattern, escape="\\"),
                )
            )
        if location_type is not None:
            stmt = stmt.where(Workshop.location_type == location_type)
        if price == "free":
            stmt = stmt.where(Workshop.price == 0)
        elif price == "paid":
            stmt = stmt.where(Workshop.price > 0)
            if max_price is not None:
                stmt = stmt.where(Workshop.price <= max_price)
    workshops = db.scalars(stmt).all()
    return [_to_read(db, w, current_user) for w in workshops]


@router.get("/{workshop_id}", response_model=WorkshopRead)
def get_workshop(
    workshop_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> WorkshopRead:
    workshop = db.get(Workshop, workshop_id)
    if workshop is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ワークショップが見つかりません")
    is_owner = current_user is not None and (
        current_user.role == UserRole.admin or current_user.id == workshop.facilitator_id
    )
    # Participants keep access to a canceled workshop they booked, so links from
    # the cancellation notice and their reservation list still resolve.
    had_reservation = (
        workshop.status == WorkshopStatus.canceled
        and current_user is not None
        and _has_reservation(db, workshop_id, current_user.id)
    )
    if workshop.status != WorkshopStatus.published and not (is_owner or had_reservation):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ワークショップが見つかりません")
    return _to_read(db, workshop, current_user)


@router.post("", response_model=WorkshopRead, status_code=status.HTTP_201_CREATED)
def create_workshop(
    payload: WorkshopInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.facilitator)),
) -> WorkshopRead:
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
    workshop = _get_owned_workshop(db, workshop_id, current_user)
    was_canceled = workshop.status == WorkshopStatus.canceled
    for field, value in payload.model_dump().items():
        setattr(workshop, field, value)
    db.commit()
    db.refresh(workshop)
    if workshop.status == WorkshopStatus.canceled and not was_canceled:
        notify_workshop_canceled(db, workshop)
    return _to_read(db, workshop, current_user)


@router.post("/{workshop_id}/image", response_model=WorkshopRead)
async def upload_workshop_image(
    workshop_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.facilitator)),
) -> WorkshopRead:
    workshop = _get_owned_workshop(db, workshop_id, current_user)
    contents = await file.read()
    new_image_url = save_workshop_image(file, contents)
    old_image_url = workshop.image_url
    workshop.image_url = new_image_url
    db.commit()
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
    workshop = _get_owned_workshop(db, workshop_id, current_user)
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
    workshop = _get_owned_workshop(db, workshop_id, current_user)
    # Deleting cascades to reservations and notifications, which would erase a
    # booking without telling the participant. Such workshops must be canceled.
    if _reserved_count(db, workshop_id) > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="予約者がいるワークショップは削除できません。開催を取りやめる場合は中止にしてください",
        )
    db.delete(workshop)
    db.commit()


@router.post("/{workshop_id}/reservations", response_model=ReservationRead, status_code=status.HTTP_201_CREATED)
def reserve_workshop(
    workshop_id: int,
    payload: ReservationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReservationRead:
    workshop = db.get(Workshop, workshop_id)
    if workshop is None or workshop.status != WorkshopStatus.published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ワークショップが見つかりません")

    if _reserved_count(db, workshop_id) + payload.ticket_count > workshop.capacity:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="残席がチケット枚数に満たないため予約できません")

    existing = (
        db.query(Reservation)
        .filter(Reservation.workshop_id == workshop_id, Reservation.user_id == current_user.id)
        .first()
    )
    if existing is not None:
        if existing.status == ReservationStatus.confirmed:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="既に予約済みです")
        existing.status = ReservationStatus.confirmed
        reservation = existing
    else:
        reservation = Reservation(workshop_id=workshop_id, user_id=current_user.id)
        db.add(reservation)

    reservation.attendee_name = payload.attendee_name
    reservation.contact = payload.contact
    reservation.ticket_count = payload.ticket_count

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="既に予約済みです") from exc
    db.refresh(reservation)
    return ReservationRead(
        id=reservation.id,
        workshop_id=reservation.workshop_id,
        workshop=_to_read(db, workshop, current_user),
        user_id=reservation.user_id,
        user_name=current_user.name,
        attendee_name=reservation.attendee_name,
        contact=reservation.contact,
        ticket_count=reservation.ticket_count,
        status=reservation.status,
        created_at=reservation.created_at,
    )


@router.get("/{workshop_id}/reservations", response_model=list[ReservationRead])
def list_workshop_reservations(
    workshop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.facilitator)),
) -> list[ReservationRead]:
    workshop = _get_owned_workshop(db, workshop_id, current_user)
    reservations = (
        db.query(Reservation)
        .filter(Reservation.workshop_id == workshop_id)
        .order_by(Reservation.created_at.asc())
        .all()
    )
    workshop_read = _to_read(db, workshop, current_user)
    return [
        ReservationRead(
            id=r.id,
            workshop_id=r.workshop_id,
            workshop=workshop_read,
            user_id=r.user_id,
            user_name=r.user.name,
            attendee_name=r.attendee_name,
            contact=r.contact,
            ticket_count=r.ticket_count,
            status=r.status,
            created_at=r.created_at,
        )
        for r in reservations
    ]


@router.post("/{workshop_id}/favorite", response_model=WorkshopRead, status_code=status.HTTP_201_CREATED)
def add_favorite(
    workshop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkshopRead:
    workshop = db.get(Workshop, workshop_id)
    is_owner = current_user.role == UserRole.admin or (
        workshop is not None and current_user.id == workshop.facilitator_id
    )
    if workshop is None or (workshop.status != WorkshopStatus.published and not is_owner):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ワークショップが見つかりません")

    existing = (
        db.query(Favorite)
        .filter(Favorite.workshop_id == workshop_id, Favorite.user_id == current_user.id)
        .first()
    )
    if existing is None:
        db.add(Favorite(workshop_id=workshop_id, user_id=current_user.id))
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="既にお気に入り登録済みです") from exc
    return _to_read(db, workshop, current_user)


@router.delete("/{workshop_id}/favorite", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(
    workshop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    favorite = (
        db.query(Favorite)
        .filter(Favorite.workshop_id == workshop_id, Favorite.user_id == current_user.id)
        .first()
    )
    if favorite is not None:
        db.delete(favorite)
        db.commit()
