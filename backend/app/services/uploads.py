from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from app.config import settings

ALLOWED_IMAGE_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}

WORKSHOP_IMAGE_URL_PREFIX = "/api/uploads/workshops"


def _workshop_image_dir() -> Path:
    path = settings.upload_path / "workshops"
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_workshop_image(file: UploadFile, contents: bytes) -> str:
    extension = ALLOWED_IMAGE_CONTENT_TYPES.get(file.content_type or "")
    if extension is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="対応していない画像形式です(jpg, png, webp, gif のみ利用できます)",
        )
    if len(contents) > settings.max_upload_size_bytes:
        max_mb = settings.max_upload_size_bytes // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"画像サイズは{max_mb}MB以内にしてください",
        )

    filename = f"{uuid4().hex}{extension}"
    (_workshop_image_dir() / filename).write_bytes(contents)
    return f"{WORKSHOP_IMAGE_URL_PREFIX}/{filename}"


def delete_workshop_image(image_url: str) -> None:
    if not image_url.startswith(f"{WORKSHOP_IMAGE_URL_PREFIX}/"):
        return
    filename = Path(image_url).name
    (_workshop_image_dir() / filename).unlink(missing_ok=True)
