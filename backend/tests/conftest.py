"""API テストの共通設定。

MySQL を用意しなくても動かせるよう、テストごとに SQLite のインメモリ DB を作り直して使う。
SQLite では SELECT ... FOR UPDATE や GET_LOCK は効かないので、同時実行の検証はここでは行わない。
"""

import os
import tempfile
from collections.abc import Callable, Generator
from datetime import timedelta
from pathlib import Path
from typing import Any

# app を読み込む前に、アップロード先を一時ディレクトリにする(main.py が読み込み時にディレクトリを作るため)
_UPLOAD_DIR = tempfile.mkdtemp(prefix="workshop_app_test_uploads_")
os.environ["UPLOAD_DIR"] = _UPLOAD_DIR
os.environ.setdefault("APP_ENV", "development")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import app.models  # noqa: E402,F401  全モデルを Base.metadata に登録する
from app.config import settings  # noqa: E402
from app.core.security import create_access_token, hash_password  # noqa: E402
from app.core.timeutil import utcnow_naive  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.models.workshop import LocationType, Workshop, WorkshopStatus  # noqa: E402
from app.routers import auth as auth_router  # noqa: E402

# 画像のアップロードに使う、シグネチャだけを持つ最小のファイル
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
JPEG_BYTES = b"\xff\xd8\xff" + b"\x00" * 32


@pytest.fixture
def db_session_factory() -> Generator[sessionmaker[Session], None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        # インメモリ DB は接続ごとに別物になるので、全セッションで同じ接続を使う
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    yield factory
    engine.dispose()


@pytest.fixture
def db(db_session_factory: sessionmaker[Session]) -> Generator[Session, None, None]:
    """テストデータの準備・結果の確認に使うセッション"""
    session = db_session_factory()
    yield session
    session.close()


@pytest.fixture
def client(db_session_factory: sessionmaker[Session]) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        session = db_session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    # with を使わないので lifespan(リマインダーのスケジューラー)は起動しない
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _reset_login_limiter() -> Generator[None, None, None]:
    auth_router._login_limiter._failures.clear()
    yield
    auth_router._login_limiter._failures.clear()


@pytest.fixture
def upload_path() -> Path:
    return settings.upload_path


@pytest.fixture
def make_user(db: Session) -> Callable[..., User]:
    counter = iter(range(1, 10_000))

    def _make(role: UserRole = UserRole.participant, *, name: str | None = None, password: str = "password123") -> User:
        n = next(counter)
        user = User(
            email=f"user{n}@example.com",
            name=name or f"{role.value}{n}",
            hashed_password=hash_password(password),
            role=role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    return _make


@pytest.fixture
def make_workshop(db: Session) -> Callable[..., Workshop]:
    def _make(facilitator: User, **overrides: Any) -> Workshop:
        start_at = overrides.pop("start_at", utcnow_naive().replace(microsecond=0) + timedelta(days=3))
        values: dict[str, Any] = {
            "title": "テストワークショップ",
            "description": "テスト用の説明です",
            "location_type": LocationType.offline,
            "location": "東京都渋谷区神宮前1-1-1",
            "start_at": start_at,
            "end_at": start_at + timedelta(hours=2),
            "capacity": 10,
            "price": 0,
            "status": WorkshopStatus.published,
            "facilitator_id": facilitator.id,
        }
        values.update(overrides)
        workshop = Workshop(**values)
        db.add(workshop)
        db.commit()
        db.refresh(workshop)
        return workshop

    return _make


def auth_headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(subject=str(user.id))}"}


def workshop_payload(workshop: Workshop, **overrides: Any) -> dict[str, Any]:
    """PUT /workshops/{id} に送る、保存済みの値そのままの入力"""
    payload: dict[str, Any] = {
        "title": workshop.title,
        "description": workshop.description,
        "location_type": workshop.location_type.value,
        "location": workshop.location,
        "start_at": workshop.start_at.isoformat(),
        "end_at": workshop.end_at.isoformat(),
        "capacity": workshop.capacity,
        "price": workshop.price,
        "payment_method": workshop.payment_method.value,
        "cancellation_policy": workshop.cancellation_policy,
        "participant_guide": workshop.participant_guide,
        "emergency_contact": workshop.emergency_contact,
        "status": workshop.status.value,
    }
    payload.update(overrides)
    return payload
