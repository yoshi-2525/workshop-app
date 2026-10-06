"""お気に入り・認証・一覧検索"""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.reservation import Reservation
from app.models.user import UserRole
from app.models.workshop import LocationType, WorkshopStatus
from tests.conftest import auth_headers


class TestFavorites:
    def test_add_list_remove(self, client: TestClient, make_user, make_workshop):
        workshop = make_workshop(make_user(UserRole.facilitator))
        user = make_user()
        res = client.post(f"/api/workshops/{workshop.id}/favorite", headers=auth_headers(user))
        assert res.status_code == 201
        assert res.json()["viewer"]["is_favorited"] is True
        # 2回目もエラーにはしない
        assert client.post(f"/api/workshops/{workshop.id}/favorite", headers=auth_headers(user)).status_code == 201

        listed = client.get("/api/favorites", headers=auth_headers(user)).json()
        assert [w["id"] for w in listed] == [workshop.id]

        assert client.delete(f"/api/workshops/{workshop.id}/favorite", headers=auth_headers(user)).status_code == 204
        assert client.get("/api/favorites", headers=auth_headers(user)).json() == []

    def test_cannot_favorite_others_draft(self, client: TestClient, make_user, make_workshop):
        workshop = make_workshop(make_user(UserRole.facilitator), status=WorkshopStatus.draft)
        res = client.post(f"/api/workshops/{workshop.id}/favorite", headers=auth_headers(make_user()))
        assert res.status_code == 404

    def test_owner_can_favorite_own_draft(self, client: TestClient, make_user, make_workshop):
        owner = make_user(UserRole.facilitator)
        workshop = make_workshop(owner, status=WorkshopStatus.draft)
        assert client.post(f"/api/workshops/{workshop.id}/favorite", headers=auth_headers(owner)).status_code == 201

    def test_missing_is_404(self, client: TestClient, make_user):
        assert client.post("/api/workshops/9999/favorite", headers=auth_headers(make_user())).status_code == 404

    def test_follows_detail_page_visibility_for_canceled(
        self, client: TestClient, db: Session, make_user, make_workshop
    ):
        # 詳細ページを見られる(予約していた)中止のワークショップは、お気に入りにも追加できる
        workshop = make_workshop(make_user(UserRole.facilitator), status=WorkshopStatus.canceled)
        reserved = make_user()
        db.add(
            Reservation(
                workshop_id=workshop.id, user_id=reserved.id, contact="a@example.com", ticket_count=1
            )
        )
        db.commit()
        assert client.post(f"/api/workshops/{workshop.id}/favorite", headers=auth_headers(reserved)).status_code == 201
        assert client.post(f"/api/workshops/{workshop.id}/favorite", headers=auth_headers(make_user())).status_code == 404


class TestAuth:
    def test_register_and_login(self, client: TestClient):
        res = client.post(
            "/api/auth/register",
            json={"name": "花子", "email": "Hanako@Example.com", "password": "password123", "role": "facilitator"},
        )
        assert res.status_code == 201
        assert res.json()["email"] == "hanako@example.com"

        login = client.post("/api/auth/login", data={"username": "hanako@example.com", "password": "password123"})
        assert login.status_code == 200
        token = login.json()["access_token"]
        me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.json()["role"] == "facilitator"

    def test_duplicate_email(self, client: TestClient):
        payload = {"name": "a", "email": "dup@example.com", "password": "password123"}
        assert client.post("/api/auth/register", json=payload).status_code == 201
        assert client.post("/api/auth/register", json=payload).status_code == 409

    def test_cannot_self_register_as_admin(self, client: TestClient):
        payload = {"name": "a", "email": "admin@example.com", "password": "password123", "role": "admin"}
        assert client.post("/api/auth/register", json=payload).status_code == 422

    def test_wrong_password(self, client: TestClient, make_user):
        user = make_user()
        res = client.post("/api/auth/login", data={"username": user.email, "password": "wrong-password"})
        assert res.status_code == 401

    def test_invalid_token(self, client: TestClient):
        assert client.get("/api/auth/me", headers={"Authorization": "Bearer invalid"}).status_code == 401

    def test_update_me(self, client: TestClient, make_user):
        user = make_user()
        res = client.patch("/api/auth/me", json={"name": "  新しい名前  "}, headers=auth_headers(user))
        assert res.status_code == 200
        assert res.json()["name"] == "新しい名前"


class TestListWorkshops:
    def test_only_upcoming_published(self, client: TestClient, make_user, make_workshop):
        facilitator = make_user(UserRole.facilitator)
        published = make_workshop(facilitator)
        make_workshop(facilitator, status=WorkshopStatus.draft)
        make_workshop(facilitator, status=WorkshopStatus.canceled)
        assert [w["id"] for w in client.get("/api/workshops").json()] == [published.id]

    def test_filters(self, client: TestClient, make_user, make_workshop):
        facilitator = make_user(UserRole.facilitator)
        online = make_workshop(facilitator, title="オンライン対話会", location_type=LocationType.online, price=0)
        paid = make_workshop(facilitator, title="陶芸体験", price=3000)

        def ids(**params):
            return [w["id"] for w in client.get("/api/workshops", params=params).json()]

        assert ids(location_type="online") == [online.id]
        assert ids(price="paid") == [paid.id]
        assert ids(price="free") == [online.id]
        assert ids(q="陶芸") == [paid.id]
        # LIKE の特殊文字はそのままの文字として扱う
        assert ids(q="%") == []

    def test_pagination_header(self, client: TestClient, make_user, make_workshop):
        facilitator = make_user(UserRole.facilitator)
        for _ in range(3):
            make_workshop(facilitator)
        res = client.get("/api/workshops", params={"limit": 2})
        assert len(res.json()) == 2
        assert res.headers["X-Total-Count"] == "3"

    def test_unknown_parameter_is_rejected(self, client: TestClient):
        assert client.get("/api/workshops", params={"unknown": "1"}).status_code == 422
