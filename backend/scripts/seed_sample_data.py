"""動作確認用の主催者・参加者・ワークショップ・予約を投入する。

Usage: ./venv/Scripts/python scripts/seed_sample_data.py
"""

import struct
import sys
import zlib
from datetime import datetime, timedelta
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.config import settings  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models.reservation import Reservation, ReservationStatus  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.models.workshop import LocationType, Workshop, WorkshopStatus  # noqa: E402

PASSWORD = "password123"

NOW = datetime(2026, 9, 10, 9, 0, 0)

# Solid-color placeholder banners (no external assets / image libraries needed).
SAMPLE_IMAGE_COLORS = [
    (217, 119, 6),  # amber
    (13, 148, 136),  # teal
    (190, 24, 93),  # pink
    (71, 85, 105),  # slate
    (161, 98, 7),  # yellow-brown
    (30, 64, 175),  # blue
    (185, 28, 28),  # red
    (4, 120, 87),  # emerald
]


def _png_chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))


def _make_placeholder_png(width: int, height: int, rgb: tuple[int, int, int]) -> bytes:
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    row = bytes([0]) + bytes(rgb) * width
    raw = row * height
    idat = zlib.compress(raw, 9)
    return (
        b"\x89PNG\r\n\x1a\n"
        + _png_chunk(b"IHDR", ihdr)
        + _png_chunk(b"IDAT", idat)
        + _png_chunk(b"IEND", b"")
    )


def _workshop_image_dir() -> Path:
    path = settings.upload_path / "workshops"
    path.mkdir(parents=True, exist_ok=True)
    return path


def ensure_sample_image(workshop: Workshop, color_index: int) -> None:
    """画像のないワークショップに、生成したバナー画像を設定する"""
    if workshop.image_url:
        return
    filename = f"sample-{workshop.id}.png"
    path = _workshop_image_dir() / filename
    if not path.exists():
        color = SAMPLE_IMAGE_COLORS[color_index % len(SAMPLE_IMAGE_COLORS)]
        path.write_bytes(_make_placeholder_png(800, 450, color))
    workshop.image_url = f"/api/uploads/workshops/{filename}"


def dt(days: int, hour: int, minute: int = 0) -> datetime:
    """hour:minute is JST; returns the naive UTC datetime the DB stores."""
    base = NOW.replace(hour=0, minute=0, second=0, microsecond=0)
    return base + timedelta(days=days, hours=hour - 9, minutes=minute)


def get_or_create_user(db, email: str, name: str, role: UserRole, bio: str = "") -> User:
    user = db.query(User).filter(User.email == email).first()
    if user is not None:
        return user
    user = User(email=email, name=name, hashed_password=hash_password(PASSWORD), role=role, bio=bio)
    db.add(user)
    db.flush()
    return user


def get_or_create_workshop(db, **kwargs) -> Workshop:
    existing = db.query(Workshop).filter(Workshop.title == kwargs["title"]).first()
    if existing is not None:
        return existing
    workshop = Workshop(**kwargs)
    db.add(workshop)
    db.flush()
    return workshop


def get_or_create_reservation(db, workshop_id: int, user_id: int, status: ReservationStatus) -> None:
    existing = (
        db.query(Reservation)
        .filter(Reservation.workshop_id == workshop_id, Reservation.user_id == user_id)
        .first()
    )
    if existing is not None:
        return
    db.add(Reservation(workshop_id=workshop_id, user_id=user_id, status=status))


def main() -> None:
    db = SessionLocal()
    try:
        admin = get_or_create_user(db, "admin@example.com", "運営 花子", UserRole.admin)

        yamada = get_or_create_user(
            db,
            "yamada@example.com",
            "山田 太郎",
            UserRole.facilitator,
            bio="哲学対話歴10年。誰もが安心して話せる場づくりを大切にしています。普段は編集者として働いています。",
        )
        suzuki = get_or_create_user(
            db,
            "suzuki@example.com",
            "鈴木 花子",
            UserRole.facilitator,
            bio="大学で哲学を専攻。卒業後は「日常に開かれた哲学」をテーマに対話イベントを主催しています。",
        )

        sato = get_or_create_user(db, "sato@example.com", "佐藤 次郎", UserRole.participant)
        tanaka = get_or_create_user(db, "tanaka@example.com", "田中 三郎", UserRole.participant)
        ito = get_or_create_user(db, "ito@example.com", "伊藤 陽子", UserRole.participant)
        watanabe = get_or_create_user(db, "watanabe@example.com", "渡辺 健", UserRole.participant)
        kobayashi = get_or_create_user(db, "kobayashi@example.com", "小林 美咲", UserRole.participant)

        db.flush()

        w1 = get_or_create_workshop(
            db,
            title="『幸せとは何か』を考える哲学カフェ",
            description="答えのない問いをゆっくり語り合う、初心者歓迎の哲学カフェです。飲み物を片手にどうぞ。",
            location_type=LocationType.offline,
            location="東京都渋谷区神宮前4丁目 表参道カフェスペース",
            start_at=dt(21, 19),
            end_at=dt(21, 21),
            capacity=12,
            price=1500,
            status=WorkshopStatus.published,
            facilitator_id=yamada.id,
        )
        w2 = get_or_create_workshop(
            db,
            title="はじめての哲学対話:問いを立てる練習",
            description="哲学対話が初めての方向けの入門編。良い「問い」の立て方から練習します。参加費無料。",
            location_type=LocationType.online,
            location="Zoom",
            start_at=dt(25, 19, 30),
            end_at=dt(25, 21),
            capacity=20,
            price=0,
            status=WorkshopStatus.published,
            facilitator_id=yamada.id,
        )
        w3 = get_or_create_workshop(
            db,
            title="『自由と責任』を語り合う夜",
            description="働き方や生き方の選択について、自由と責任というテーマから語り合います。",
            location_type=LocationType.offline,
            location="東京都渋谷区渋谷2丁目 渋谷コミュニティスペース",
            start_at=dt(32, 19),
            end_at=dt(32, 21, 30),
            capacity=10,
            price=2000,
            status=WorkshopStatus.published,
            facilitator_id=suzuki.id,
        )
        w4 = get_or_create_workshop(
            db,
            title="少人数制:『死』について語り合う対話会",
            description="普段はなかなか話せない「死」というテーマに、少人数でじっくり向き合います。",
            location_type=LocationType.online,
            location="Zoom",
            start_at=dt(15, 20),
            end_at=dt(15, 22),
            capacity=6,
            price=3000,
            status=WorkshopStatus.published,
            facilitator_id=suzuki.id,
        )
        w5 = get_or_create_workshop(
            db,
            title="月イチ哲学ゼミ(準備中)",
            description="毎月1回開催予定の継続ゼミです。詳細は近日公開します。",
            location_type=LocationType.online,
            location="Zoom",
            start_at=dt(52, 19),
            end_at=dt(52, 21),
            capacity=10,
            price=2500,
            status=WorkshopStatus.draft,
            facilitator_id=yamada.id,
        )
        w6 = get_or_create_workshop(
            db,
            title="夏休み特別対話会",
            description="都合により中止となりました。",
            location_type=LocationType.offline,
            location="東京都渋谷区神宮前4丁目 表参道カフェスペース",
            start_at=dt(-40, 19),
            end_at=dt(-40, 21),
            capacity=20,
            price=1000,
            status=WorkshopStatus.canceled,
            facilitator_id=suzuki.id,
        )
        w7 = get_or_create_workshop(
            db,
            title="1on1哲学対話:あなたの人生相談",
            description="ファシリテーターと1対1でじっくり対話する特別枠です。少人数限定。",
            location_type=LocationType.offline,
            location="東京都渋谷区神宮前4丁目 表参道カフェスペース",
            start_at=dt(40, 13),
            end_at=dt(40, 14),
            capacity=4,
            price=5000,
            status=WorkshopStatus.published,
            facilitator_id=yamada.id,
        )
        w8 = get_or_create_workshop(
            db,
            title="オープン哲学カフェ(参加費無料)",
            description="どなたでも気軽に参加できる無料のオープン哲学カフェです。",
            location_type=LocationType.online,
            location="Zoom",
            start_at=dt(8, 19),
            end_at=dt(8, 20, 30),
            capacity=30,
            price=0,
            status=WorkshopStatus.published,
            facilitator_id=suzuki.id,
        )

        db.flush()

        for index, workshop in enumerate([w1, w2, w3, w4, w5, w6, w7, w8]):
            ensure_sample_image(workshop, index)

        get_or_create_reservation(db, w1.id, sato.id, ReservationStatus.confirmed)
        get_or_create_reservation(db, w1.id, tanaka.id, ReservationStatus.confirmed)
        get_or_create_reservation(db, w1.id, ito.id, ReservationStatus.confirmed)

        get_or_create_reservation(db, w2.id, sato.id, ReservationStatus.confirmed)
        get_or_create_reservation(db, w2.id, watanabe.id, ReservationStatus.confirmed)

        get_or_create_reservation(db, w3.id, tanaka.id, ReservationStatus.confirmed)
        get_or_create_reservation(db, w3.id, kobayashi.id, ReservationStatus.confirmed)
        get_or_create_reservation(db, w3.id, ito.id, ReservationStatus.confirmed)

        get_or_create_reservation(db, w4.id, sato.id, ReservationStatus.confirmed)
        get_or_create_reservation(db, w4.id, tanaka.id, ReservationStatus.confirmed)
        get_or_create_reservation(db, w4.id, ito.id, ReservationStatus.confirmed)
        get_or_create_reservation(db, w4.id, watanabe.id, ReservationStatus.confirmed)
        get_or_create_reservation(db, w4.id, kobayashi.id, ReservationStatus.confirmed)

        get_or_create_reservation(db, w7.id, sato.id, ReservationStatus.confirmed)
        get_or_create_reservation(db, w7.id, tanaka.id, ReservationStatus.confirmed)
        get_or_create_reservation(db, w7.id, ito.id, ReservationStatus.canceled)

        get_or_create_reservation(db, w8.id, watanabe.id, ReservationStatus.confirmed)
        get_or_create_reservation(db, w8.id, kobayashi.id, ReservationStatus.confirmed)

        db.commit()
        print("seed complete")
        print(f"  admin:       admin@example.com / {PASSWORD}")
        print(f"  facilitator: yamada@example.com / {PASSWORD}")
        print(f"  facilitator: suzuki@example.com / {PASSWORD}")
        print(f"  participant: sato@example.com / {PASSWORD}")
        print(f"  participant: tanaka@example.com / {PASSWORD}")
        print(f"  participant: ito@example.com / {PASSWORD}")
        print(f"  participant: watanabe@example.com / {PASSWORD}")
        print(f"  participant: kobayashi@example.com / {PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
