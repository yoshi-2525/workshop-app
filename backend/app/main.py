from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import SessionLocal
from app.routers import auth, facilitators, favorites, notifications, reservations, workshops
from app.services.notifications import send_upcoming_reminders

REMINDER_JOB_INTERVAL_MINUTES = 30


def _run_reminder_job() -> None:
    db = SessionLocal()
    try:
        send_upcoming_reminders(db)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = BackgroundScheduler()
    scheduler.add_job(_run_reminder_job, "interval", minutes=REMINDER_JOB_INTERVAL_MINUTES)
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="Workshop App API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router_prefix = "/api"
app.include_router(auth.router, prefix=api_router_prefix)
app.include_router(workshops.router, prefix=api_router_prefix)
app.include_router(reservations.router, prefix=api_router_prefix)
app.include_router(favorites.router, prefix=api_router_prefix)
app.include_router(facilitators.router, prefix=api_router_prefix)
app.include_router(notifications.router, prefix=api_router_prefix)

settings.upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=settings.upload_path), name="uploads")


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
