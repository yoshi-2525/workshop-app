from sqlalchemy import exists, func, select
from sqlalchemy.orm import Session

from app.models.favorite import Favorite
from app.models.reservation import Reservation, ReservationStatus
from app.models.user import User
from app.models.workshop import Workshop
from app.schemas.workshop import WorkshopRead


def reserved_count(db: Session, workshop_id: int) -> int:
    stmt = select(func.coalesce(func.sum(Reservation.ticket_count), 0)).where(
        Reservation.workshop_id == workshop_id,
        Reservation.status == ReservationStatus.confirmed,
    )
    return db.scalar(stmt) or 0


def is_favorited(db: Session, workshop_id: int, user_id: int) -> bool:
    stmt = select(
        exists().where(Favorite.workshop_id == workshop_id, Favorite.user_id == user_id)
    )
    return bool(db.scalar(stmt))


def is_reserved(db: Session, workshop_id: int, user_id: int) -> bool:
    stmt = select(
        exists().where(
            Reservation.workshop_id == workshop_id,
            Reservation.user_id == user_id,
            Reservation.status == ReservationStatus.confirmed,
        )
    )
    return bool(db.scalar(stmt))


def to_workshop_read(db: Session, workshop: Workshop, current_user: User | None = None) -> WorkshopRead:
    return WorkshopRead(
        id=workshop.id,
        title=workshop.title,
        description=workshop.description,
        image_url=workshop.image_url,
        location_type=workshop.location_type,
        location=workshop.location,
        start_at=workshop.start_at,
        end_at=workshop.end_at,
        capacity=workshop.capacity,
        price=workshop.price,
        cancellation_policy=workshop.cancellation_policy,
        status=workshop.status,
        facilitator_id=workshop.facilitator_id,
        facilitator_name=workshop.facilitator.name,
        reserved_count=reserved_count(db, workshop.id),
        is_favorited=is_favorited(db, workshop.id, current_user.id) if current_user else False,
        is_reserved=is_reserved(db, workshop.id, current_user.id) if current_user else False,
    )
