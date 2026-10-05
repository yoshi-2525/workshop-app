"""主催者のフォローと、フォロワーへの新着通知"""

from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.timeutil import utcnow_naive
from app.models.follow import FacilitatorFollow
from app.models.notification import Notification, NotificationType
from app.models.user import UserRole
from app.models.workshop import LocationType, WorkshopStatus
from tests.conftest import auth_headers, workshop_payload


def _follow(client: TestClient, user, facilitator_id: int):
    return client.post(f"/api/facilitators/{facilitator_id}/follow", headers=auth_headers(user))


def _new_workshop_payload(status: str = "published") -> dict:
    start_at = utcnow_naive().replace(microsecond=0) + timedelta(days=3)
    return {
        "title": "新しい対話",
        "description": "説明",
        "location_type": LocationType.offline.value,
        "location": "東京都渋谷区",
        "start_at": start_at.isoformat(),
        "end_at": (start_at + timedelta(hours=2)).isoformat(),
        "capacity": 10,
        "price": 0,
        "status": status,
    }


def _new_workshop_notices(db: Session) -> list[Notification]:
    db.expire_all()
    return list(db.scalars(select(Notification).where(Notification.type == NotificationType.new_workshop)))


class TestFollow:
    def test_follow_list_unfollow(self, client: TestClient, make_user):
        facilitator = make_user(UserRole.facilitator)
        user = make_user()
        assert _follow(client, user, facilitator.id).status_code == 201
        # 2回目もエラーにはしない
        assert _follow(client, user, facilitator.id).status_code == 201

        res = client.get("/api/follows/facilitators", headers=auth_headers(user))
        assert [f["id"] for f in res.json()] == [facilitator.id]
        assert res.json()[0]["viewer"] == {"is_following": True}

        url = f"/api/facilitators/{facilitator.id}/follow"
        assert client.delete(url, headers=auth_headers(user)).status_code == 204
        assert client.delete(url, headers=auth_headers(user)).status_code == 204
        assert client.get("/api/follows/facilitators", headers=auth_headers(user)).json() == []

    def test_only_facilitators_can_be_followed(self, client: TestClient, make_user):
        user = make_user()
        assert _follow(client, user, make_user().id).status_code == 404
        assert _follow(client, user, make_user(UserRole.admin).id).status_code == 404
        assert _follow(client, user, 9999).status_code == 404

    def test_cannot_follow_self(self, client: TestClient, make_user):
        facilitator = make_user(UserRole.facilitator)
        assert _follow(client, facilitator, facilitator.id).status_code == 409

    def test_requires_login(self, client: TestClient, make_user):
        facilitator = make_user(UserRole.facilitator)
        assert client.post(f"/api/facilitators/{facilitator.id}/follow").status_code == 401
        assert client.get("/api/follows/facilitators").status_code == 401
        assert client.get("/api/follows/workshops").status_code == 401

    def test_no_longer_facilitator_is_hidden(self, client: TestClient, db: Session, make_user, make_workshop):
        facilitator = make_user(UserRole.facilitator)
        user = make_user()
        _follow(client, user, facilitator.id)
        make_workshop(facilitator)
        facilitator.role = UserRole.admin
        db.commit()
        assert client.get("/api/follows/facilitators", headers=auth_headers(user)).json() == []
        assert client.get("/api/follows/workshops", headers=auth_headers(user)).json() == []

    def test_profile_viewer(self, client: TestClient, make_user):
        facilitator = make_user(UserRole.facilitator)
        user = make_user()
        url = f"/api/facilitators/{facilitator.id}"
        assert client.get(url).json()["viewer"] is None
        assert client.get(url, headers=auth_headers(user)).json()["viewer"] == {"is_following": False}
        _follow(client, user, facilitator.id)
        assert client.get(url, headers=auth_headers(user)).json()["viewer"] == {"is_following": True}
        # 自分自身のページはフォローの対象にしない
        assert client.get(url, headers=auth_headers(facilitator)).json()["viewer"] is None
        # 運営のページはフォローの対象にしない
        admin = make_user(UserRole.admin)
        assert client.get(f"/api/facilitators/{admin.id}", headers=auth_headers(user)).json()["viewer"] is None


class TestFollowedWorkshops:
    def test_lists_upcoming_published_of_followed_only(self, client: TestClient, make_user, make_workshop):
        facilitator = make_user(UserRole.facilitator)
        other = make_user(UserRole.facilitator)
        user = make_user()
        _follow(client, user, facilitator.id)

        later = make_workshop(facilitator, start_at=utcnow_naive().replace(microsecond=0) + timedelta(days=5))
        sooner = make_workshop(facilitator)
        make_workshop(facilitator, status=WorkshopStatus.draft)
        make_workshop(facilitator, status=WorkshopStatus.canceled)
        make_workshop(facilitator, start_at=utcnow_naive().replace(microsecond=0) - timedelta(days=1))
        make_workshop(other)

        res = client.get("/api/follows/workshops", params={"limit": 10}, headers=auth_headers(user))
        assert res.status_code == 200
        assert [w["id"] for w in res.json()] == [sooner.id, later.id]
        assert res.headers["X-Total-Count"] == "2"

    def test_sort(self, client: TestClient, make_user, make_workshop):
        facilitator = make_user(UserRole.facilitator)
        user = make_user()
        _follow(client, user, facilitator.id)
        sooner_paid = make_workshop(facilitator, price=3000)
        later_free = make_workshop(
            facilitator, start_at=utcnow_naive().replace(microsecond=0) + timedelta(days=5), price=0
        )
        url = "/api/follows/workshops"

        def ids(sort: str) -> list[int]:
            res = client.get(url, params={"sort": sort}, headers=auth_headers(user))
            return [w["id"] for w in res.json()]

        assert ids("start") == [sooner_paid.id, later_free.id]
        assert ids("price") == [later_free.id, sooner_paid.id]
        assert client.get(url, params={"sort": "unknown"}, headers=auth_headers(user)).status_code == 422


class TestNewWorkshopNotices:
    def test_create_published_notifies_followers(self, client: TestClient, db: Session, make_user):
        facilitator = make_user(UserRole.facilitator, name="山田")
        follower = make_user()
        make_user()  # フォローしていない人には届かない
        _follow(client, follower, facilitator.id)

        res = client.post("/api/workshops", json=_new_workshop_payload(), headers=auth_headers(facilitator))
        assert res.status_code == 201
        notices = _new_workshop_notices(db)
        assert [(n.user_id, n.workshop_id) for n in notices] == [(follower.id, res.json()["id"])]
        assert "山田さん" in notices[0].message

    def test_publishing_draft_notifies_once(self, client: TestClient, db: Session, make_user, make_workshop):
        facilitator = make_user(UserRole.facilitator)
        follower = make_user()
        _follow(client, follower, facilitator.id)

        draft = make_workshop(facilitator, status=WorkshopStatus.draft)
        url = f"/api/workshops/{draft.id}"
        # 下書きのまま更新しても通知しない
        assert client.put(url, json=workshop_payload(draft, title="直した"), headers=auth_headers(facilitator)).status_code == 200
        assert _new_workshop_notices(db) == []

        assert client.put(url, json=workshop_payload(draft, status="published"), headers=auth_headers(facilitator)).status_code == 200
        assert len(_new_workshop_notices(db)) == 1

        # 公開中のものを編集しても、もう一度は通知しない
        db.refresh(draft)
        res = client.put(
            url, json=workshop_payload(draft, title="再編集"), headers=auth_headers(facilitator)
        )
        assert res.status_code == 200
        assert len(_new_workshop_notices(db)) == 1

    def test_create_draft_does_not_notify(self, client: TestClient, db: Session, make_user):
        facilitator = make_user(UserRole.facilitator)
        _follow(client, make_user(), facilitator.id)
        res = client.post("/api/workshops", json=_new_workshop_payload("draft"), headers=auth_headers(facilitator))
        assert res.status_code == 201
        assert _new_workshop_notices(db) == []

    def test_admin_publish_does_not_notify(self, client: TestClient, db: Session, make_user):
        admin = make_user(UserRole.admin)
        # 主催者だったときにフォローされ、その後に運営になった場合を想定して直接登録する
        db.add(FacilitatorFollow(follower_id=make_user().id, facilitator_id=admin.id))
        db.commit()
        res = client.post("/api/workshops", json=_new_workshop_payload(), headers=auth_headers(admin))
        assert res.status_code == 201
        assert _new_workshop_notices(db) == []

    def test_notice_listed_for_follower(self, client: TestClient, make_user):
        facilitator = make_user(UserRole.facilitator)
        follower = make_user()
        _follow(client, follower, facilitator.id)
        client.post("/api/workshops", json=_new_workshop_payload(), headers=auth_headers(facilitator))
        listed = client.get("/api/notifications", headers=auth_headers(follower)).json()
        assert [n["type"] for n in listed] == ["new_workshop"]

    def test_admin_publishing_facilitators_draft_notifies(
        self, client: TestClient, db: Session, make_user, make_workshop
    ):
        # 通知するかは公開した人ではなく持ち主で決める。運営が代わりに公開しても主催者の新着として届く
        facilitator = make_user(UserRole.facilitator)
        follower = make_user()
        _follow(client, follower, facilitator.id)
        draft = make_workshop(facilitator, status=WorkshopStatus.draft)
        res = client.put(
            f"/api/workshops/{draft.id}",
            json=workshop_payload(draft, status="published"),
            headers=auth_headers(make_user(UserRole.admin)),
        )
        assert res.status_code == 200
        assert [n.user_id for n in _new_workshop_notices(db)] == [follower.id]

    def test_cancel_removes_notices(self, client: TestClient, db: Session, make_user):
        # 中止したワークショップは予約していない人には見えないので、新着の通知も取り消す
        facilitator = make_user(UserRole.facilitator)
        _follow(client, make_user(), facilitator.id)
        res = client.post("/api/workshops", json=_new_workshop_payload(), headers=auth_headers(facilitator))
        assert len(_new_workshop_notices(db)) == 1
        cancel = client.post(f"/api/workshops/{res.json()['id']}/cancel", headers=auth_headers(facilitator))
        assert cancel.status_code == 200
        assert _new_workshop_notices(db) == []
