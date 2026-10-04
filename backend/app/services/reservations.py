from collections.abc import Sequence
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import RESERVATION_NOT_FOUND, WORKSHOP_NOT_FOUND, conflict, not_found
from app.core.timeutil import hours_label, utcnow_naive
from app.models.reservation import AttendanceStatus, Reservation, ReservationStatus
from app.models.user import User
from app.models.workshop import Workshop, WorkshopStatus
from app.schemas.reservation import ReservationCreate, ReservationRead
from app.services.notifications import add_reservation_canceled_notice
from app.services.workshops import (
    RESERVATION_DEADLINE_BEFORE,
    lock_workshop,
    reservation_deadline,
    reserved_count,
    to_workshop_reads,
)

# 出欠は開始日時のこの時間前から記録できる(受付の準備や、前日に欠席の連絡を受けた場合のため)。
# フロントエンドの utils/workshop.ts の ATTENDANCE_OPEN_HOURS_BEFORE と揃える
ATTENDANCE_OPEN_BEFORE = timedelta(hours=24)

# to_reservation_reads は予約者名・ワークショップ・主催者名を参照するので、一覧はこれを付けて読み込む
RESERVATION_LOAD_OPTIONS = (
    selectinload(Reservation.user),
    selectinload(Reservation.workshop).selectinload(Workshop.facilitator),
)


def to_reservation_reads(
    db: Session, reservations: Sequence[Reservation], current_user: User | None = None
) -> list[ReservationRead]:
    """複数件をまとめて変換する。ワークショップ部分は同じものを1回だけ組み立てる。

    予約者名・ワークショップ・主催者名は関連を参照するので、呼び出し側で
    RESERVATION_LOAD_OPTIONS を付けて読み込んでおくと 1件ずつの読み込みを避けられる。
    """
    unique_workshops = list({r.workshop_id: r.workshop for r in reservations}.values())
    workshop_reads = {w.id: w for w in to_workshop_reads(db, unique_workshops, current_user)}
    return [
        ReservationRead(
            id=r.id,
            workshop_id=r.workshop_id,
            workshop=workshop_reads[r.workshop_id],
            user_id=r.user_id,
            user_name=r.user.name,
            attendee_name=r.attendee_name,
            contact=r.contact,
            ticket_count=r.ticket_count,
            status=r.status,
            attendance=r.attendance,
            created_at=r.created_at,
        )
        for r in reservations
    ]


def to_reservation_read(db: Session, reservation: Reservation, current_user: User | None = None) -> ReservationRead:
    return to_reservation_reads(db, [reservation], current_user)[0]


def get_workshop_reservation(db: Session, workshop: Workshop, reservation_id: int) -> Reservation:
    """ワークショップの予約を1件取得する。別のワークショップの予約は存在しないのと同じく 404 にする"""
    reservation = db.get(Reservation, reservation_id)
    if reservation is None or reservation.workshop_id != workshop.id:
        raise not_found(RESERVATION_NOT_FOUND)
    return reservation


def create_reservation(db: Session, workshop_id: int, user: User, payload: ReservationCreate) -> Reservation:
    """予約できるかを確かめてから予約を追加する(commit は呼び出し側)。

    同時に申し込まれても定員を超えないよう、ワークショップの行をロックしてから予約数を数える(commit まで保持)
    """
    workshop = lock_workshop(db, workshop_id)
    if workshop is None or workshop.status != WorkshopStatus.published:
        raise not_found(WORKSHOP_NOT_FOUND)
    if utcnow_naive() >= reservation_deadline(workshop.start_at):
        raise conflict(f"予約の受付は開始日時の{hours_label(RESERVATION_DEADLINE_BEFORE)}前で締め切りました")
    if workshop.facilitator_id == user.id:
        raise conflict("自分が主催するワークショップは予約できません")

    existing = db.scalar(
        select(Reservation).where(Reservation.workshop_id == workshop_id, Reservation.user_id == user.id)
    )
    if existing is not None:
        if existing.status == ReservationStatus.confirmed:
            raise conflict("既に予約済みです")
        # キャンセル済みの予約は主催者が取り消したもの。主催者の判断を覆さないよう、再予約させない
        raise conflict("主催者により参加がキャンセルされたため、このワークショップは予約できません")
    if reserved_count(db, workshop_id) + payload.ticket_count > workshop.capacity:
        raise conflict("残席がチケット枚数に満たないため予約できません")

    reservation = Reservation(
        workshop_id=workshop_id,
        user_id=user.id,
        # 同じアカウントでは同じ名前で参加する想定なので、参加者名はアカウント名を使う
        attendee_name=user.name,
        contact=payload.contact,
        ticket_count=payload.ticket_count,
    )
    db.add(reservation)
    return reservation


def cancel_reservation(db: Session, workshop: Workshop, reservation: Reservation) -> None:
    """主催者(と運営)が予約をキャンセルし、参加者に通知する(commit は呼び出し側)。

    予約の受付と同時に走っても残席の数が食い違わないよう、workshop は lock_workshop で取得したものを渡すこと
    """
    if reservation.status == ReservationStatus.canceled:
        raise conflict("この予約は既にキャンセルされています")
    if workshop.status == WorkshopStatus.canceled:
        raise conflict("中止したワークショップの予約はキャンセルできません")
    if workshop.start_at <= utcnow_naive():
        raise conflict("開始済みのワークショップの予約はキャンセルできません")

    reservation.status = ReservationStatus.canceled
    # キャンセルと参加者への通知は、同じトランザクションでまとめて確定する
    add_reservation_canceled_notice(db, reservation)


def record_attendance(workshop: Workshop, reservation: Reservation, attendance: AttendanceStatus) -> None:
    """開催当日の出欠を記録する(commit は呼び出し側)。記録の誤りを直せるよう、開催後も変更できる"""
    if workshop.status != WorkshopStatus.published:
        raise conflict("公開中のワークショップだけ出欠を記録できます")
    if reservation.status != ReservationStatus.confirmed:
        raise conflict("キャンセルされた予約の出欠は記録できません")
    if utcnow_naive() < workshop.start_at - ATTENDANCE_OPEN_BEFORE:
        raise conflict(f"出欠は開始日時の{hours_label(ATTENDANCE_OPEN_BEFORE)}前から記録できます")
    reservation.attendance = attendance
