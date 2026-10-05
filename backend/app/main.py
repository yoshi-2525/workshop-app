from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response
from starlette.types import Scope

from app.config import settings
from app.core.body_limit import BodySizeLimitMiddleware
from app.database import SessionLocal
from app.routers import (
    auth,
    facilitators,
    favorites,
    follows,
    inquiries,
    manage,
    notifications,
    reservations,
    workshops,
)
from app.services.notifications import send_upcoming_reminders
from app.services.uploads import max_request_body_bytes, too_large_message

REMINDER_JOB_INTERVAL_MINUTES = 30


def _run_reminder_job() -> None:
    db = SessionLocal()
    try:
        send_upcoming_reminders(db)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.check_jwt_secret()
    scheduler = BackgroundScheduler()
    scheduler.add_job(_run_reminder_job, "interval", minutes=REMINDER_JOB_INTERVAL_MINUTES)
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


class _UploadedFiles(StaticFiles):
    """アップロードされたファイルを配信する。ブラウザに拡張子どおりの種類として扱わせる"""

    async def get_response(self, path: str, scope: Scope) -> Response:
        response = await super().get_response(path, scope)
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response


app = FastAPI(title="Workshop App API", lifespan=lifespan)

# 大きすぎる本文は受け取りきる前に断る(Content-Length のない chunked の送信も含む)。
# 後から追加したミドルウェアほど外側になる。413 の応答にも CORS ヘッダーが付くよう、CORS より先に追加する
app.add_middleware(BodySizeLimitMiddleware, max_body_bytes=max_request_body_bytes(), detail=too_large_message())
# 認証は Authorization ヘッダーの Bearer トークンで行い Cookie を使わないので、allow_credentials は付けない
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],
)

api_router_prefix = "/api"
app.include_router(auth.router, prefix=api_router_prefix)
app.include_router(workshops.router, prefix=api_router_prefix)
app.include_router(reservations.router, prefix=api_router_prefix)
app.include_router(favorites.router, prefix=api_router_prefix)
app.include_router(facilitators.router, prefix=api_router_prefix)
app.include_router(follows.router, prefix=api_router_prefix)
app.include_router(notifications.router, prefix=api_router_prefix)
app.include_router(inquiries.router, prefix=api_router_prefix)
app.include_router(manage.router, prefix=api_router_prefix)

settings.upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/api/uploads", _UploadedFiles(directory=settings.upload_path), name="uploads")


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
