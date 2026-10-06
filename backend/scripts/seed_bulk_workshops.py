"""Seed ~50 test workshops (with reservations) for list / search / paging checks.

Varies status, date (past / upcoming), location type, price and fill rate so
every screen state shows up. Output is deterministic and re-running skips
workshops whose title already exists.

Usage: ./venv/Scripts/python scripts/seed_bulk_workshops.py
"""

import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal  # noqa: E402
from app.models.reservation import MAX_TICKETS_PER_RESERVATION, Reservation, ReservationStatus  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.models.workshop import LocationType, Workshop, WorkshopStatus  # noqa: E402
from seed_sample_data import (  # noqa: E402
    PASSWORD,
    ensure_sample_image,
    get_or_create_user,
    get_or_create_workshop,
)

WORKSHOP_COUNT = 50
SEED = 20260926
JST = timezone(timedelta(hours=9))

THEMES = [
    "幸せとは何か", "自由と責任", "正義とは", "友情について", "働くことの意味",
    "美しさとは", "嘘をついてもよいか", "時間とは何か", "私とは誰か", "愛と執着",
    "善く生きるとは", "運と努力", "言葉と沈黙", "孤独について", "大人になるとは",
    "家族とは", "お金で買えないもの", "AIと人間らしさ", "記憶と自分", "偶然と必然",
    "怒りとの付き合い方", "学ぶことの意味", "遊びと真面目", "他者を理解できるか", "ふつうとは何か",
    "死について", "勇気とは", "公平とは", "信じるということ", "豊かさとは",
]
FORMATS = ["哲学カフェ", "対話会", "読書会", "ゼミ", "ワークショップ"]
OFFLINE_VENUES = [
    "東京都渋谷区神宮前4丁目 表参道カフェスペース",
    "東京都渋谷区渋谷2丁目 渋谷コミュニティスペース",
    "東京都新宿区新宿3丁目 新宿レンタルスペース",
    "東京都千代田区神田神保町1丁目 ブックカフェ神保町",
    "東京都世田谷区北沢2丁目 下北沢コミュニティルーム",
    "神奈川県横浜市中区山下町 横浜みなとスペース",
]
ONLINE_VENUE = "Zoom"
EXTRA_FACILITATORS = [
    ("takahashi@example.com", "高橋 誠", "高校で倫理を教えています。10代から大人まで一緒に考える場を開いています。"),
    ("nakamura@example.com", "中村 さやか", "読書会と哲学対話を組み合わせた会を月2回主催しています。"),
]
EXTRA_PARTICIPANTS = [
    ("participant01@example.com", "加藤 翔太"),
    ("participant02@example.com", "吉田 恵"),
    ("participant03@example.com", "山口 大輔"),
    ("participant04@example.com", "松本 あかり"),
    ("participant05@example.com", "井上 拓也"),
    ("participant06@example.com", "木村 奈々"),
    ("participant07@example.com", "林 直樹"),
    ("participant08@example.com", "清水 真由"),
    ("participant09@example.com", "山崎 亮"),
    ("participant10@example.com", "森 千尋"),
]
SAMPLE_PARTICIPANT_EMAILS = [
    "sato@example.com", "tanaka@example.com", "ito@example.com",
    "watanabe@example.com", "kobayashi@example.com",
]


def jst_to_utc(days: int, hour: int, minute: int = 0) -> datetime:
    """Today (JST) + days at hour:minute JST, as the naive UTC datetime the DB stores."""
    today = datetime.now(JST).replace(hour=0, minute=0, second=0, microsecond=0)
    local = today + timedelta(days=days, hours=hour, minutes=minute)
    return local.astimezone(timezone.utc).replace(tzinfo=None)


def build_titles(rng: random.Random) -> list[tuple[str, str]]:
    # seed_sample_data.py で使っているタイトルは除き、50件すべてを新しいものにする
    pairs = [
        (theme, fmt)
        for theme in THEMES
        for fmt in FORMATS
        if (theme, fmt) != ("幸せとは何か", "哲学カフェ")
    ]
    rng.shuffle(pairs)
    return pairs[:WORKSHOP_COUNT]


def pick_status(rng: random.Random) -> WorkshopStatus:
    roll = rng.random()
    if roll < 0.1:
        return WorkshopStatus.draft
    if roll < 0.2:
        return WorkshopStatus.canceled
    return WorkshopStatus.published


def add_reservations(
    db, rng: random.Random, workshop: Workshop, participants: list[User], full: bool
) -> None:
    if db.query(Reservation).filter(Reservation.workshop_id == workshop.id).first() is not None:
        return
    target = workshop.capacity if full else rng.randint(0, int(workshop.capacity * 0.8))
    pool = participants[:]
    rng.shuffle(pool)
    booked = 0
    for index, user in enumerate(pool):
        if booked >= target:
            break
        is_last = index == len(pool) - 1
        tickets = target - booked if (full and is_last) else rng.choice([1, 1, 1, 2, 2, 3])
        tickets = max(1, min(tickets, target - booked, MAX_TICKETS_PER_RESERVATION))
        # A few bookings are canceled so the reservation screens show both states.
        status = ReservationStatus.canceled if rng.random() < 0.08 else ReservationStatus.confirmed
        db.add(
            Reservation(
                workshop_id=workshop.id,
                user_id=user.id,
                contact=user.email,
                ticket_count=tickets,
                status=status,
            )
        )
        if status == ReservationStatus.confirmed:
            booked += tickets


def main() -> None:
    rng = random.Random(SEED)
    db = SessionLocal()
    try:
        facilitators = [
            get_or_create_user(db, "yamada@example.com", "山田 太郎", UserRole.facilitator),
            get_or_create_user(db, "suzuki@example.com", "鈴木 花子", UserRole.facilitator),
        ] + [get_or_create_user(db, e, n, UserRole.facilitator, bio=b) for e, n, b in EXTRA_FACILITATORS]
        participants = [
            u for u in (db.query(User).filter(User.email == e).first() for e in SAMPLE_PARTICIPANT_EMAILS) if u
        ] + [get_or_create_user(db, e, n, UserRole.participant) for e, n in EXTRA_PARTICIPANTS]

        created = 0
        for index, (theme, fmt) in enumerate(build_titles(rng)):
            title = f"『{theme}』を考える{fmt}"
            exists = db.query(Workshop).filter(Workshop.title == title).first() is not None

            status = pick_status(rng)
            is_past = rng.random() < 0.2
            days = -rng.randint(1, 60) if is_past else rng.randint(1, 90)
            hour = rng.choice([10, 13, 14, 19, 19, 20])
            duration = rng.choice([60, 90, 120, 150])
            is_online = rng.random() < 0.5
            price = 0 if rng.random() < 0.3 else rng.choice([500, 1000, 1500, 2000, 3000, 5000])
            capacity = rng.choice([4, 6, 8, 10, 12, 15, 20, 30])
            full = status == WorkshopStatus.published and rng.random() < 0.15

            workshop = get_or_create_workshop(
                db,
                title=title,
                description=(
                    f"「{theme}」をテーマにした{fmt}です。正解を探すのではなく、"
                    "一人ひとりの考えをゆっくり聞き合う時間にします。初めての方も歓迎です。"
                ),
                location_type=LocationType.online if is_online else LocationType.offline,
                location=ONLINE_VENUE if is_online else rng.choice(OFFLINE_VENUES),
                start_at=jst_to_utc(days, hour),
                end_at=jst_to_utc(days, hour, duration),
                capacity=capacity,
                price=price,
                status=status,
                facilitator_id=rng.choice(facilitators).id,
            )
            if exists:
                continue
            ensure_sample_image(workshop, index)
            if status != WorkshopStatus.draft:
                add_reservations(db, rng, workshop, participants, full)
            created += 1

        db.commit()
        print(f"bulk seed complete: {created} workshops created ({WORKSHOP_COUNT - created} already existed)")
        print(f"  facilitators: takahashi@example.com, nakamura@example.com / {PASSWORD}")
        print(f"  participants: participant01〜10@example.com / {PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
