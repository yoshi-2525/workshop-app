from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

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
# multipart の区切りやヘッダーの分として、リクエスト本文には画像サイズの上限に加えてこれだけ許す
_MULTIPART_OVERHEAD_BYTES = 64 * 1024

_UPLOAD_URL_PREFIX = "/api/uploads"


def _image_dir(subdir: str) -> Path:
    path = settings.upload_path / subdir
    path.mkdir(parents=True, exist_ok=True)
    return path


def too_large_message() -> str:
    max_mb = settings.max_upload_size_bytes // (1024 * 1024)
    return f"画像サイズは{max_mb}MB以内にしてください"


def max_request_body_bytes() -> int:
    """リクエスト本文の上限(main.py の BodySizeLimitMiddleware で使う)。画像のアップロードが最も大きい"""
    return settings.max_upload_size_bytes + _MULTIPART_OVERHEAD_BYTES


def _too_large_error() -> HTTPException:
    return HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail=too_large_message())


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


@dataclass(frozen=True)
class ImageStore:
    """アップロード先ディレクトリの下の、1つのサブディレクトリに保存する画像"""

    subdir: str

    def save(self, file: UploadFile) -> str:
        """画像として確かめてから保存し、配信用の URL を返す"""
        contents = _read_limited(file)
        extension = _detect_image_extension(contents[:16])
        if extension is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="対応していない画像形式です(jpg, png, webp, gif のみ利用できます)",
            )

        filename = f"{uuid4().hex}{extension}"
        (_image_dir(self.subdir) / filename).write_bytes(contents)
        return f"{_UPLOAD_URL_PREFIX}/{self.subdir}/{filename}"

    def delete(self, image_url: str) -> None:
        # このアプリが保存した画像以外(空文字や想定外の URL)は消さない
        if not image_url.startswith(f"{_UPLOAD_URL_PREFIX}/{self.subdir}/"):
            return
        filename = Path(image_url).name
        (_image_dir(self.subdir) / filename).unlink(missing_ok=True)


WORKSHOP_IMAGES = ImageStore("workshops")
AVATAR_IMAGES = ImageStore("avatars")


def replace_image(db: Session, target: object, field: str, store: ImageStore, file: UploadFile | None) -> None:
    """target の画像 URL の項目(field)を、file を保存した画像に差し替えて commit する。file が None なら画像を外す。

    同時に差し替えられても古い画像を確実に消せるよう、target の行はロックしてから渡すこと。
    DB に記録できなかった新しい画像はどこからも参照されないので消し、記録できたら古い画像を消す
    """
    new_url = store.save(file) if file is not None else ""
    old_url: str = getattr(target, field)
    setattr(target, field, new_url)
    try:
        db.commit()
    except Exception:
        db.rollback()
        if new_url:
            store.delete(new_url)
        raise
    db.refresh(target)
    if old_url:
        store.delete(old_url)
