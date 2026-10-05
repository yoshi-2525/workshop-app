# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`app/routers/` は HTTP の入口。リクエストを受け取り、認証・権限を確かめ、`services/` を呼んで、トランザクションを確定し、レスポンスを返す。バックエンド全体の方針は `backend/CLAUDE.md`、業務ロジックの置き場所は `app/services/CLAUDE.md` を参照。

## ルーターの責務

ルーターがすること:

- パス・クエリ・本文を受け取る（検証は `schemas/` の Pydantic に任せる）
- `Depends` で DB セッションとログインユーザーを受け取り、ロールを確かめる
- service の取得・判定・変更の関数を呼ぶ
- **トランザクションを確定する**（`db.commit()` → `db.refresh()`）。一意制約違反の `IntegrityError` を 409 に変えるのもここ
- `to_xxx_read(s)` でレスポンススキーマに変換して返す

ルーターに書かないこと:

- 業務ルールの判定（締め切り・定員・状態の遷移・「誰が何をできるか」）→ `services/`
- 他人のリソースかどうかの判定 → service の取得関数（`get_managed_workshop` など）
- 複数のルーターで使う SELECT の組み立て → service の `xxx_select()` 関数

自分のリソースだけを対象にする単純な一覧・既読・削除（`notifications.py`、`favorites.py`、`manage.py`、`reservations.py` の `/me`）は、業務ルールがないのでルーター内でクエリを書いてよい。ただし `where(Xxx.user_id == current_user.id)` で自分のものに絞ることを忘れない。

## エンドポイントの書き方

```python
@router.post("/{workshop_id}/cancel", response_model=WorkshopRead)
def cancel_published_workshop(
    workshop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_manager),
) -> WorkshopRead:
    """公開中のワークショップを中止にする。予約済みの参加者には中止のお知らせが届く。中止は取り消せない"""
    workshop = get_managed_workshop(db, workshop_id, current_user, for_update=True)
    cancel_workshop(db, workshop)
    db.commit()
    db.refresh(workshop)
    return to_workshop_read(db, workshop, current_user)
```

- `def` で書く（`async def` にしない）。同期の DB セッションとファイル書き込みでイベントループを止めないよう、スレッドプールで動かすため。
- `response_model` と戻り値の型を必ず書く。作成は `status_code=status.HTTP_201_CREATED`、本文を返さない削除・既読は `HTTP_204_NO_CONTENT`。
- `router = APIRouter(prefix=..., tags=[...])` をファイル先頭に置く。新しいルーターは `app/main.py` で `prefix="/api"` を付けて登録する。
- ユーザーから見た操作の意味や、副作用（通知が届くなど）、取り消せるかは docstring に書く（Swagger UI に出る）。

### 認証・権限

| 依存性 | 使う場面 |
|---|---|
| `get_current_user` | ログイン必須 |
| `get_current_user_optional` | 未ログインでも見られるが、ログイン時は表示が変わる（お気に入り済みなど） |
| `require_roles(UserRole.admin, UserRole.facilitator)` | 主催者・運営だけの操作。同じファイルで繰り返すときは `_manager = require_roles(...)` にする |

ロールの確認だけでは「他人のワークショップ」を防げない。ワークショップを操作するときは必ず `get_managed_workshop()`（管理）か `get_viewable_workshop()`（閲覧）で取得する。

### 行ロック

定員・状態・画像が関わる更新は、取得時に行をロックする。

- ワークショップ: `get_managed_workshop(..., for_update=True)` または `lock_workshop()`
- ログインユーザー自身: `db.refresh(current_user, with_for_update=True)`

ロックは `db.commit()` で外れるので、判定から commit までを1つのリクエストの中で続けて行う。

### 一意制約違反

先に存在チェックをしても同時リクエストで重複しうるので、commit を `try` で囲んで 409 にする。

```python
try:
    db.commit()
except IntegrityError as exc:
    db.rollback()
    raise conflict("既に予約済みです") from exc
```

冪等にしたい操作（お気に入りの追加・フォロー）は、既にあれば何もせず成功として返す。削除も、対象がなければ何もせず 204 を返す。

### 一覧

- クエリパラメータは `PageQuery` を継承したモデルにまとめ、`Annotated[XxxQuery, Query()]` で受ける。そのルーターだけで使うものはルーター内に定義してよい（例: `inquiries.py` の `InquiryListQuery`）。
- `paginate(db, stmt, page, response)` を通し、総件数を `X-Total-Count` で返す。`response: Response` を引数に入れる。
- 並び順の最後に `id` を付けて順序を固定する。
- 関連を参照する変換の前に `selectinload` を付ける。

## URL の設計

- リソースに対する操作は、そのリソースの URL の下に置く（`/workshops/{id}/favorite`、`/workshops/{id}/reservations/{rid}/cancel`、`/facilitators/{id}/follow`）。そのため1つのルーターが別の prefix の URL を持つことがあり、その場合は `prefix` なしで `APIRouter(tags=[...])` にする（`favorites.py`、`follows.py`、`inquiries.py`）。
- 状態を変える操作のうち、単純な更新でないもの（中止・キャンセル・既読・一斉送信）は `POST /{id}/動詞` にする。中止を `PUT` の `status` 変更で受け付けないのは、通知を伴う別の操作として扱うため。
- 「自分の」一覧は `/me`（`/reservations/me`、`/auth/me`）か、ユーザーに結びつく一覧（`/favorites`、`/notifications`、`/follows/...`）にする。

## ファイルごとの役割

| ファイル | prefix | 役割 |
|---|---|---|
| `auth.py` | `/auth` | 登録・ログイン・自分のプロフィール（名前・自己紹介）とアイコン。ログインは `core/rate_limit.py` の `FailureLimiter` で IP とメールアドレスごとに失敗回数を数え、上限で 429。存在しないメールでも `burn_password_check` で応答時間をそろえる。アイコンは主催者・運営だけ |
| `workshops.py` | `/workshops` | 公開一覧と検索・詳細・関連ワークショップ、作成・更新・中止・削除・画像、予約の受付、主催者による予約一覧・キャンセル・出欠の記録。削除できるのは下書きだけ（公開・中止したものは記録として残す） |
| `manage.py` | `/manage` | 主催者の管理画面用の一覧。下書き・中止を含む自分のワークショップ（admin は全員分） |
| `reservations.py` | `/reservations` | 自分の予約一覧だけ。参加者は自分で予約をキャンセルできない（キャンセルは主催者が `workshops.py` で行う） |
| `favorites.py` | なし | お気に入りの一覧（`/favorites`）と追加・削除（`/workshops/{id}/favorite`）。見られるワークショップならお気に入りにできる |
| `facilitators.py` | `/facilitators` | 主催者の公開プロフィール。主催者・運営以外の ID は 404。ログイン中は `viewer.is_following` を付ける |
| `follows.py` | なし | 主催者のフォロー・解除（`/facilitators/{id}/follow`）と、フォロー中の主催者・その開催予定のワークショップの一覧（`/follows/...`） |
| `notifications.py` | `/notifications` | 自分宛ての通知の一覧・未読数・既読（1件／すべて）。通知の作成はここではなく `services/notifications.py` |
| `payouts.py` | `/facilitators/me/payout-account` | 主催者の参加費の受け取り設定（Stripe の連結アカウント）。状態の取得（設定の途中なら Stripe から読み直す）、受け取り設定の画面・売上ダッシュボードへの URL。主催者・運営だけ |
| `inquiries.py` | なし | 参加者と主催者のやり取り（問い合わせ）。一覧・未読数・詳細・既読・返信（`/inquiries/...`）と、ワークショップからの問い合わせ・主催者の一斉送信（`/workshops/{id}/inquiry...`）。一斉送信は運営でも他人のワークショップからは送れない |

## テスト

エンドポイントを追加・変更したら、`tests/` に API を通したテストを追加する。権限のあるケースだけでなく、他人・別ロール・未ログインで弾かれること（403 / 404 / 401）も確かめる。
