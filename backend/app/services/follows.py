from sqlalchemy import Select, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import FACILITATOR_NOT_FOUND, conflict, not_found
from app.models.follow import FOLLOWABLE_ROLE, FacilitatorFollow
from app.models.user import User
from app.models.workshop import Workshop
from app.schemas.workshop import WorkshopSearchQuery, WorkshopSort
from app.services.workshops import public_workshops_select

# フォローできるのは主催者(FOLLOWABLE_ROLE)だけ。
# 一覧もこの条件で絞るので、フォローした後に相手の役割が変わった場合は一覧に出なくなる


def get_followable_facilitator(db: Session, user_id: int) -> User:
    """フォローの対象にできる主催者を取得する。主催者でなければ存在しないのと同じく 404 にする"""
    user = db.get(User, user_id)
    if user is None or user.role != FOLLOWABLE_ROLE:
        raise not_found(FACILITATOR_NOT_FOUND)
    return user


def _my_follow(user: User, facilitator_id: int) -> Select[tuple[FacilitatorFollow]]:
    return select(FacilitatorFollow).where(
        FacilitatorFollow.follower_id == user.id, FacilitatorFollow.facilitator_id == facilitator_id
    )


def follow_facilitator(db: Session, user: User, facilitator_id: int) -> None:
    """主催者をフォローする。フォロー済みなら何もしない"""
    if facilitator_id == user.id:
        raise conflict("自分自身はフォローできません")
    get_followable_facilitator(db, facilitator_id)
    if db.scalar(_my_follow(user, facilitator_id)) is not None:
        return
    db.add(FacilitatorFollow(follower_id=user.id, facilitator_id=facilitator_id))
    try:
        db.commit()
    except IntegrityError:
        # 同じフォローが同時に作られた場合。結果は同じなので成功として扱う
        db.rollback()


def unfollow_facilitator(db: Session, user: User, facilitator_id: int) -> None:
    """フォローを解除する。フォローしていなければ何もしない"""
    follow = db.scalar(_my_follow(user, facilitator_id))
    if follow is not None:
        db.delete(follow)
        db.commit()


def is_following(db: Session, user: User | None, facilitator_id: int) -> bool:
    if user is None:
        return False
    return bool(db.scalar(select(_my_follow(user, facilitator_id).exists())))


def followed_facilitators_select(user: User) -> Select[tuple[User]]:
    """フォロー中の主催者。新しくフォローした順"""
    return (
        select(User)
        .join(FacilitatorFollow, FacilitatorFollow.facilitator_id == User.id)
        .where(FacilitatorFollow.follower_id == user.id, User.role == FOLLOWABLE_ROLE)
        .order_by(FacilitatorFollow.created_at.desc(), FacilitatorFollow.id.desc())
    )


def followed_workshops_select(user: User, sort: WorkshopSort = "start") -> Select[tuple[Workshop]]:
    """フォロー中の主催者の、開催予定のワークショップ。公開一覧と同じ条件(公開中・開始前)・並び順で返す"""
    followed_ids = (
        select(FacilitatorFollow.facilitator_id)
        .join(User, User.id == FacilitatorFollow.facilitator_id)
        .where(FacilitatorFollow.follower_id == user.id, User.role == FOLLOWABLE_ROLE)
    )
    return public_workshops_select(WorkshopSearchQuery(sort=sort), user).where(
        Workshop.facilitator_id.in_(followed_ids)
    )
