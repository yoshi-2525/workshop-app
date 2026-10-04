"""ワークショップ画像・主催者アイコンのアップロードと削除"""

from pathlib import Path

from fastapi.testclient import TestClient

from app.models.user import UserRole
from app.models.workshop import WorkshopStatus
from tests.conftest import JPEG_BYTES, PNG_BYTES, auth_headers


def _stored_file(upload_path: Path, url: str) -> Path:
    # /api/uploads/<subdir>/<filename> → <upload_path>/<subdir>/<filename>
    return upload_path / url.removeprefix("/api/uploads/")


class TestWorkshopImage:
    def test_upload_replace_and_remove(self, client: TestClient, make_user, make_workshop, upload_path: Path):
        owner = make_user(UserRole.facilitator)
        workshop = make_workshop(owner)
        url = f"/api/workshops/{workshop.id}/image"

        first = client.post(url, files={"file": ("a.png", PNG_BYTES)}, headers=auth_headers(owner))
        assert first.status_code == 200
        first_url = first.json()["image_url"]
        assert first_url.startswith("/api/uploads/workshops/") and first_url.endswith(".png")
        assert _stored_file(upload_path, first_url).exists()

        # 差し替えると古い画像は消える
        second = client.post(url, files={"file": ("b.jpg", JPEG_BYTES)}, headers=auth_headers(owner))
        assert second.status_code == 200
        second_url = second.json()["image_url"]
        assert second_url.endswith(".jpg")
        assert not _stored_file(upload_path, first_url).exists()
        assert _stored_file(upload_path, second_url).exists()

        removed = client.delete(url, headers=auth_headers(owner))
        assert removed.status_code == 200
        assert removed.json()["image_url"] == ""
        assert not _stored_file(upload_path, second_url).exists()

    def test_rejects_unknown_format(self, client: TestClient, make_user, make_workshop):
        owner = make_user(UserRole.facilitator)
        workshop = make_workshop(owner)
        res = client.post(
            f"/api/workshops/{workshop.id}/image",
            files={"file": ("a.png", b"not an image")},
            headers=auth_headers(owner),
        )
        assert res.status_code == 400

    def test_other_facilitator_cannot_upload(self, client: TestClient, make_user, make_workshop):
        workshop = make_workshop(make_user(UserRole.facilitator))
        other = make_user(UserRole.facilitator)
        res = client.post(
            f"/api/workshops/{workshop.id}/image", files={"file": ("a.png", PNG_BYTES)}, headers=auth_headers(other)
        )
        assert res.status_code == 403

    def test_canceled_workshop_cannot_change_image(self, client: TestClient, make_user, make_workshop):
        owner = make_user(UserRole.facilitator)
        workshop = make_workshop(owner, status=WorkshopStatus.canceled)
        res = client.post(
            f"/api/workshops/{workshop.id}/image", files={"file": ("a.png", PNG_BYTES)}, headers=auth_headers(owner)
        )
        assert res.status_code == 409

    def test_deleting_draft_removes_image(self, client: TestClient, make_user, make_workshop, upload_path: Path):
        owner = make_user(UserRole.facilitator)
        workshop = make_workshop(owner, status=WorkshopStatus.draft)
        image_url = client.post(
            f"/api/workshops/{workshop.id}/image", files={"file": ("a.png", PNG_BYTES)}, headers=auth_headers(owner)
        ).json()["image_url"]
        assert client.delete(f"/api/workshops/{workshop.id}", headers=auth_headers(owner)).status_code == 204
        assert not _stored_file(upload_path, image_url).exists()


class TestAvatar:
    def test_upload_replace_and_remove(self, client: TestClient, make_user, upload_path: Path):
        facilitator = make_user(UserRole.facilitator)

        first = client.post("/api/auth/me/avatar", files={"file": ("a.png", PNG_BYTES)}, headers=auth_headers(facilitator))
        assert first.status_code == 200
        first_url = first.json()["avatar_url"]
        assert first_url.startswith("/api/uploads/avatars/")
        assert _stored_file(upload_path, first_url).exists()

        second = client.post(
            "/api/auth/me/avatar", files={"file": ("b.jpg", JPEG_BYTES)}, headers=auth_headers(facilitator)
        )
        second_url = second.json()["avatar_url"]
        assert not _stored_file(upload_path, first_url).exists()
        assert _stored_file(upload_path, second_url).exists()

        removed = client.delete("/api/auth/me/avatar", headers=auth_headers(facilitator))
        assert removed.status_code == 200
        assert removed.json()["avatar_url"] == ""
        assert not _stored_file(upload_path, second_url).exists()

    def test_participant_cannot_set_avatar(self, client: TestClient, make_user):
        res = client.post("/api/auth/me/avatar", files={"file": ("a.png", PNG_BYTES)}, headers=auth_headers(make_user()))
        assert res.status_code == 403
