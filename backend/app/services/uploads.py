from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, Request, UploadFile, status

from app.config import settings

# 画像の種類は、クライアントが送ってくる Content-Type ではなくファイル先頭のバイト列で判定する
_IMAGE_SIGNATURES: tuple[tuple[bytes, int, str], ...] = (
    # (シグネチャ, ファイル先頭からの位置, 拡張子)
    (b"\xff\xd8\xff", 0, ".jpg"),
    (b"\x89PNG\r\n\x1a\n", 0, ".png"),
    (b"GIF87a", 0, ".gif"),
    (b"GIF89a", 0, ".gif"),
)
_READ_CHUNK_BYTES = 64 * 1024
# multipart の区切りやヘッダーの分として、Content-Length には画像サイズの上限に加えてこれだけ許す
_MULTIPART_OVERHEAD_BYTES = 64 * 1024

WORKSHOP_IMAGE_URL_PREFIX = "/api/uploads/workshops"


def _workshop_image_dir() -> Path:
    path = settings.upload_path / "workshops"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _too_large_error() -> HTTPException:
    max_mb = settings.max_upload_size_bytes // (1024 * 1024)
    return HTTPException(
        status_code=status.HTTP_413_CONTENT_TOO_LARGE,
        detail=f"画像サイズは{max_mb}MB以内にしてください",
    )


def reject_oversized_upload(request: Request) -> None:
    """依存関係として使い、リクエスト本文を受け取る前に Content-Length で大きすぎる送信を断る"""
    content_length = request.headers.get("content-length")
    if (
        content_length is not None
        and content_length.isdigit()
        and int(content_length) > settings.max_upload_size_bytes + _MULTIPART_OVERHEAD_BYTES
    ):
        raise _too_large_error()


def _detect_image_extension(head: bytes) -> str | None:
    for signature, offset, extension in _IMAGE_SIGNATURES:
        if head[offset : offset + len(signature)] == signature:
            return extension
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return ".webp"
    return None


def _read_limited(file: UploadFile) -> bytes:
    """上限を超えた時点で読むのをやめる"""
    chunks: list[bytes] = []
    total = 0
    while chunk := file.file.read(_READ_CHUNK_BYTES):
        total += len(chunk)
        if total > settings.max_upload_size_bytes:
            raise _too_large_error()
        chunks.append(chunk)
    return b"".join(chunks)


def save_workshop_image(file: UploadFile) -> str:
    contents = _read_limited(file)
    extension = _detect_image_extension(contents[:16])
    if extension is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="対応していない画像形式です(jpg, png, webp, gif のみ利用できます)",
        )

    filename = f"{uuid4().hex}{extension}"
    (_workshop_image_dir() / filename).write_bytes(contents)
    return f"{WORKSHOP_IMAGE_URL_PREFIX}/{filename}"


def delete_workshop_image(image_url: str) -> None:
    if not image_url.startswith(f"{WORKSHOP_IMAGE_URL_PREFIX}/"):
        return
    filename = Path(image_url).name
    (_workshop_image_dir() / filename).unlink(missing_ok=True)
