# 機能一覧表

最終更新日: 2026-09-25

Workshop App の機能をカテゴリごとに一覧化し、利用者（権限）・画面・API との対応を示す。画面を持たない機能（スケジューラ、運用スクリプト等）も含む。別表として全 API エンドポイントの一覧を置く。

## 凡例

- 利用者（権限）
  - **全員**: 未ログインを含むすべての利用者
  - **ログイン**: ログイン済みユーザー（participant / facilitator / admin のいずれでも可）
  - **主催者**: facilitator または admin
  - **管理者**: admin のみ
  - **システム**: 利用者操作によらず自動実行
- API のパスはすべて `/api` プレフィックス付き。
- カテゴリ略称: AUTH（認証）/ WS（ワークショップ閲覧）/ RSV（予約）/ FAV（お気に入り）/ NTF（通知）/ PRF（プロフィール）/ MNG（主催者管理）/ SYS（システム）

## 機能一覧

### 認証（AUTH）

| 機能ID | カテゴリ | 機能名 | 概要 | 利用者（権限） | 画面 | API（メソッド + パス） |
|---|---|---|---|---|---|---|
| F-AUTH-01 | 認証 | アカウント種別選択 | ログイン・新規登録時に「参加者」「主催者」のどちらかを選ぶ | 全員 | `/login`、`/register` | — |
| F-AUTH-02 | 認証 | 参加者ログイン | メールアドレス・パスワードでログイン。participant 以外のアカウントは拒否（即ログアウト）。成功時は `state.from` または `/` へ | 全員 | `/login/participant` | `POST /api/auth/login`、`GET /api/auth/me` |
| F-AUTH-03 | 認証 | 主催者ログイン | 同上。facilitator / admin のみ許可。成功時は `state.from` または `/manage` へ | 全員 | `/login/facilitator` | `POST /api/auth/login`、`GET /api/auth/me` |
| F-AUTH-04 | 認証 | 参加者登録 | 名前・メール・パスワード（8 文字以上）で participant として登録し、自動ログイン | 全員 | `/register/participant` | `POST /api/auth/register`、`POST /api/auth/login`、`GET /api/auth/me` |
| F-AUTH-05 | 認証 | 主催者登録 | facilitator として登録し、自動ログインして `/manage` へ | 全員 | `/register/facilitator` | `POST /api/auth/register`、`POST /api/auth/login`、`GET /api/auth/me` |
| F-AUTH-06 | 認証 | ログイン状態の復元 | 起動時に localStorage の JWT でユーザー情報を取得。失敗時・401 応答時はトークンを破棄 | ログイン | （全画面共通） | `GET /api/auth/me` |
| F-AUTH-07 | 認証 | ログアウト | トークンを破棄して `/login` へ遷移（サーバー API 呼び出しなし） | ログイン | `/settings` | — |
| F-AUTH-08 | 認証 | 画面アクセス制御 | 未ログイン時はログイン画面へ（`state.from` 付き）、主催者画面にロール不足でアクセスすると `/` へリダイレクト | 全員 | ログイン必須画面・`/manage` 配下 | — |
| F-AUTH-09 | 認証 | ロール変更（管理者付与） | 運用スクリプトで既存ユーザーのロールを変更する。admin は API からは作成できない | 管理者（運用者） | なし（`backend/scripts/set_role.py`） | — |

### ワークショップ閲覧（WS）

| 機能ID | カテゴリ | 機能名 | 概要 | 利用者（権限） | 画面 | API（メソッド + パス） |
|---|---|---|---|---|---|---|
| F-WS-01 | ワークショップ | 公開ワークショップ一覧 | 公開中（published）のワークショップを 30 件ずつカード表示。ログイン中は、自分が予約済み（確定済み）のワークショップと、自分が主催するワークショップを除く（キャンセル済みの予約は除かない）。並び替えは開催日時の近い順（既定）/ 公開日時の新しい順 / 価格の安い順 | 全員 | `/` | `GET /api/workshops?sort=&limit=&offset=&exclude_reserved=true&exclude_own=true` |
| F-WS-02 | ワークショップ | ワークショップ検索・絞り込み | キーワード（タイトル・説明の部分一致、最大 100 文字）、開催形式（オフライン / オンライン）、料金（無料 / 有料）、上限金額（有料時）、開催日（今日 / 明日 / 直近1週間 / 期間を指定（検索開始日〜検索終了日。片方のみも可、終了日はその日を含む）。日付の区切りは利用者の端末の時間帯で計算し、API には開催日時の範囲として渡す）。検索フォームとは別に「参加可能なワークショップを表示する」チェックボックス（満員を除外、即時反映） | 全員 | `/` | `GET /api/workshops?q=&location_type=&price=&max_price=&start_from=&start_to=&available=` |
| F-WS-03 | ワークショップ | ワークショップ詳細 | 画像・日時・場所・参加費・定員・説明・キャンセルポリシーを表示。下書きは主催者本人と admin のみ、中止はそれに加えて予約したことのあるユーザーも閲覧可（「中止になりました」と表示） | 全員 | `/workshops/:id` | `GET /api/workshops/{workshop_id}` |
| F-WS-04 | ワークショップ | 地図表示リンク | オフライン開催の場所を Google マップ検索で新しいタブに表示 | 全員 | `/workshops/:id` | —（外部リンク） |
| F-WS-05 | ワークショップ | 閲覧者別の状態表示 | ログインユーザーごとのお気に入り登録状態・予約済み状態（`viewer`）をカード・詳細に反映 | ログイン | `/`、`/workshops/:id`、`/favorites`、`/facilitators/:id` | `GET /api/workshops`、`GET /api/workshops/{workshop_id}` |
| F-WS-06 | ワークショップ | 主催者プロフィール閲覧 | 主催者の名前・ロール（主催者 / 運営）・自己紹介と、その主催者の公開ワークショップ一覧を表示 | 全員 | `/facilitators/:id` | `GET /api/facilitators/{user_id}`、`GET /api/workshops?facilitator_id=` |

### 予約（RSV）

| 機能ID | カテゴリ | 機能名 | 概要 | 利用者（権限） | 画面 | API（メソッド + パス） |
|---|---|---|---|---|---|---|
| F-RSV-01 | 予約 | 予約（参加者情報入力） | 参加者名・連絡先・チケット枚数（1〜「残席と 20 の小さい方」）を入力して予約を確定。公開中でないワークショップは予約不可のメッセージを表示。残席不足・予約済みは 409。キャンセル済みの予約があれば再有効化 | ログイン | `/workshops/:id/reserve` | `GET /api/workshops/{workshop_id}`、`POST /api/workshops/{workshop_id}/reservations` |
| F-RSV-02 | 予約 | 自分の予約一覧 | 自分の予約を「参加予定」（終了前）/「参加履歴」（終了後）のタブで表示。予約直後は完了メッセージを表示 | ログイン | `/reservations` | `GET /api/reservations/me` |
| F-RSV-03 | 予約 | 予約キャンセル | 確認ダイアログ（有料時はキャンセルポリシー併記）の後、予約を `canceled` に更新 | ログイン（予約者本人） | `/reservations` | `DELETE /api/reservations/{reservation_id}` |

### お気に入り（FAV）

| 機能ID | カテゴリ | 機能名 | 概要 | 利用者（権限） | 画面 | API（メソッド + パス） |
|---|---|---|---|---|---|---|
| F-FAV-01 | お気に入り | お気に入り登録 | ♡ ボタンでお気に入りに追加。未ログイン時は参加者ログインへ誘導。失敗時は `alert()` でエラー表示。詳細画面では公開中のみボタンを表示 | ログイン | `/`、`/workshops/:id`、`/favorites`、`/facilitators/:id` | `POST /api/workshops/{workshop_id}/favorite` |
| F-FAV-02 | お気に入り | お気に入り解除 | ♡ ボタンで解除。失敗時は `alert()` でエラー表示 | ログイン | 同上 | `DELETE /api/workshops/{workshop_id}/favorite` |
| F-FAV-03 | お気に入り | お気に入り一覧 | 自分のお気に入りを登録日時の新しい順に表示 | ログイン | `/favorites` | `GET /api/favorites` |

### 通知（NTF）

| 機能ID | カテゴリ | 機能名 | 概要 | 利用者（権限） | 画面 | API（メソッド + パス） |
|---|---|---|---|---|---|---|
| F-NTF-01 | 通知 | 通知一覧 | 自分宛ての通知（中止 / 開催前日）を新しい順に表示。クリックでワークショップ詳細へ | ログイン | `/notifications` | `GET /api/notifications` |
| F-NTF-02 | 通知 | 未読件数バッジ | Navbar の 🔔 に未読件数を表示。60 秒ごとにポーリング | ログイン | Navbar | `GET /api/notifications/unread-count` |
| F-NTF-03 | 通知 | 通知の既読化 | 通知カードのクリックで 1 件を既読化 | ログイン（宛先本人） | `/notifications` | `POST /api/notifications/{notification_id}/read` |
| F-NTF-04 | 通知 | すべて既読 | 未読の通知をまとめて既読化 | ログイン | `/notifications` | `POST /api/notifications/read-all` |
| F-NTF-05 | 通知 | 中止通知の自動作成 | ワークショップが `canceled` に変更されたとき、予約確定済みの参加者へ `cancellation` 通知を作成 | システム（主催者の中止操作を契機） | なし | `POST /api/workshops/{workshop_id}/cancel` の内部処理 |
| F-NTF-06 | 通知 | 開催前日リマインド | 30 分間隔のジョブで、開始 23〜25 時間前の公開ワークショップの予約確定者へ `reminder` 通知を作成（同一通知は 1 回のみ） | システム（APScheduler） | なし | — |

### プロフィール・設定（PRF）

| 機能ID | カテゴリ | 機能名 | 概要 | 利用者（権限） | 画面 | API（メソッド + パス） |
|---|---|---|---|---|---|---|
| F-PRF-01 | プロフィール | 設定メニュー | プロフィール編集・ワークショップ管理（主催者のみ）・予約履歴へのメニューを表示 | ログイン | `/settings` | — |
| F-PRF-02 | プロフィール | プロフィール編集 | 表示名（必須、最大 255 文字）と自己紹介（最大 2000 文字）を更新 | ログイン | `/settings/profile` | `PATCH /api/auth/me`、`GET /api/auth/me` |

### 主催者管理（MNG）

| 機能ID | カテゴリ | 機能名 | 概要 | 利用者（権限） | 画面 | API（メソッド + パス） |
|---|---|---|---|---|---|---|
| F-MNG-01 | 主催者管理 | 自分のワークショップ一覧 | 自分のワークショップ（admin は全件）を「開催予定」/「開催履歴」タブで表示。ステータス・参加費・予約数を表示 | 主催者 | `/manage` | `GET /api/manage/workshops` |
| F-MNG-02 | 主催者管理 | ワークショップ作成 | タイトル・説明・開催形式・場所・日時・定員・参加費・キャンセルポリシーを入力し、下書き保存または公開 | 主催者 | `/manage/workshops/new` | `POST /api/workshops` |
| F-MNG-03 | 主催者管理 | ワークショップ編集 | 既存ワークショップを編集し、下書き保存または公開。開催済み（終了日時を過ぎた）ものは編集不可：管理画面の「開催履歴」タブに「編集」を出さず、編集画面を直接開いても「開催済みのワークショップは編集できません。」を表示し、API も 409 を返す | 主催者（所有者 / admin） | `/manage/workshops/:id/edit` | `GET /api/workshops/{workshop_id}`、`PUT /api/workshops/{workshop_id}` |
| F-MNG-04 | 主催者管理 | ワークショップ画像の登録・削除 | jpg / png / webp / gif（5MB 以内）の画像をアップロード、または削除。旧画像ファイルは削除。開催済みのものは API が 409 を返す | 主催者（所有者 / admin） | `/manage/workshops/new`、`/manage/workshops/:id/edit` | `POST /api/workshops/{workshop_id}/image`、`DELETE /api/workshops/{workshop_id}/image` |
| F-MNG-05 | 主催者管理 | ワークショップ中止 | 確認（「予約済みの参加者には中止のお知らせが自動で届きます。」）後、ステータスを `canceled` に更新（F-NTF-05 の通知を発火）。操作は編集画面の下部の「ワークショップの中止」から行う（編集中の内容は保存しない） | 主催者（所有者 / admin） | `/manage/workshops/:id/edit` | `POST /api/workshops/{workshop_id}/cancel` |
| F-MNG-06 | 主催者管理 | ワークショップ削除 | 確認後、ワークショップを物理削除（関連するキャンセル済み予約・お気に入り・通知も ORM カスケードで削除）。開催予定（終了日時前）のものは下書きのみ削除でき、公開中・中止は削除ボタンを出さず API も 409 を返す（取りやめる場合は中止を利用する）。確定済み予約がある場合は削除ボタンが無効で、API も 409 を返す | 主催者（所有者 / admin） | `/manage` | `DELETE /api/workshops/{workshop_id}` |
| F-MNG-07 | 主催者管理 | 予約状況の確認 | ワークショップの予約者一覧（参加者名・連絡先・枚数・状態・予約日時）と確定チケット数を表示 | 主催者（所有者 / admin） | `/manage/workshops/:id/reservations` | `GET /api/workshops/{workshop_id}`、`GET /api/workshops/{workshop_id}/reservations` |
| F-MNG-08 | 主催者管理 | 入力内容の自動保存 | 作成・編集フォームの入力内容を 1 秒ごと（入力が止まったとき）にブラウザの localStorage へ自動保存し、次に開いたときに復元・破棄を選べる。画像は対象外。保存成功・キャンセルで削除 | 主催者 | `/manage/workshops/new`、`/manage/workshops/:id/edit` | —（ブラウザ内のみ） |

### システム（SYS）

| 機能ID | カテゴリ | 機能名 | 概要 | 利用者（権限） | 画面 | API（メソッド + パス） |
|---|---|---|---|---|---|---|
| F-SYS-01 | システム | ヘルスチェック | `{"status": "ok"}` を返す | 全員 | なし | `GET /api/health` |
| F-SYS-02 | システム | アップロード画像の配信 | 保存済みのワークショップ画像を静的ファイルとして配信 | 全員 | カード・詳細・管理画面の画像表示 | `GET /api/uploads/workshops/{filename}` |
| F-SYS-03 | システム | 404 ページ | 未定義パスを `/404` にリダイレクトして表示 | 全員 | `/404` | — |
| F-SYS-04 | システム | サンプルデータ投入 | 動作確認用のユーザー・ワークショップ・予約を投入する運用スクリプト（内容は未確認） | 運用者 | なし（`backend/scripts/seed_sample_data.py`） | — |

## API 一覧

認証要否: 「不要」= トークンなしで可、「任意」= トークンがあれば閲覧者情報を反映、「必須」= ログイン必須、「主催者」= facilitator / admin 必須（`require_roles`）。

| No | メソッド | パス | 認証要否 | 概要 | ルーターファイル |
|---|---|---|---|---|---|
| 1 | POST | `/api/auth/register` | 不要 | ユーザー登録（role は facilitator / participant のみ）。メール重複は 409 | `backend/app/routers/auth.py` |
| 2 | POST | `/api/auth/login` | 不要 | ログイン（form: username, password）。JWT を返す。失敗は 401 | `backend/app/routers/auth.py` |
| 3 | GET | `/api/auth/me` | 必須 | ログインユーザー情報の取得 | `backend/app/routers/auth.py` |
| 4 | PATCH | `/api/auth/me` | 必須 | 表示名・自己紹介の更新 | `backend/app/routers/auth.py` |
| 5 | GET | `/api/workshops` | 任意 | 公開中のワークショップの検索・一覧。クエリ: `facilitator_id`, `q`, `location_type`, `price`, `max_price`, `available`, `exclude_reserved`, `exclude_own`, `start_from`, `start_to`, `sort`, `limit`, `offset`（`limit` 指定時は総件数を `X-Total-Count` ヘッダーで返す）。検索条件は `WorkshopSearchQuery`（`backend/app/schemas/workshop.py`）で受け取り、存在しないパラメータや `start_from >= start_to` は 422 | `backend/app/routers/workshops.py` |
| 5-2 | GET | `/api/manage/workshops` | 主催者・管理者 | 管理用のワークショップ一覧。下書き・中止を含む自分のワークショップ（admin は全員分）を開催日時の新しい順で返す。未ログインは 401、参加者は 403 | `backend/app/routers/manage.py` |
| 6 | GET | `/api/workshops/{workshop_id}` | 任意 | ワークショップ詳細。非公開は所有者 / admin 以外 404。ただし中止済みは、そのワークショップを予約したことのあるユーザーも閲覧可 | `backend/app/routers/workshops.py` |
| 7 | POST | `/api/workshops` | 主催者 | ワークショップ作成 | `backend/app/routers/workshops.py` |
| 8 | PUT | `/api/workshops/{workshop_id}` | 主催者（所有者 / admin） | ワークショップ更新。`canceled` への変更は受け付けず 409（中止は 8-2 で行う） | `backend/app/routers/workshops.py` |
| 8-2 | POST | `/api/workshops/{workshop_id}/cancel` | 主催者（所有者 / admin） | 公開中のワークショップを中止にし、予約確定済みの参加者へ中止通知を作成。下書き・中止済み・開催済みは 409 | `backend/app/routers/workshops.py` |
| 9 | DELETE | `/api/workshops/{workshop_id}` | 主催者（所有者 / admin） | ワークショップ削除（204）。開催予定（終了日時前）で下書き以外のもの、または確定済み予約がある場合は 409 | `backend/app/routers/workshops.py` |
| 10 | POST | `/api/workshops/{workshop_id}/image` | 主催者（所有者 / admin） | 画像アップロード（multipart, `file`） | `backend/app/routers/workshops.py` |
| 11 | DELETE | `/api/workshops/{workshop_id}/image` | 主催者（所有者 / admin） | 画像削除 | `backend/app/routers/workshops.py` |
| 12 | POST | `/api/workshops/{workshop_id}/reservations` | 必須 | 予約作成（公開中のみ）。残席不足・予約済みは 409 | `backend/app/routers/workshops.py` |
| 13 | GET | `/api/workshops/{workshop_id}/reservations` | 主催者（所有者 / admin） | ワークショップの予約一覧（作成日時昇順） | `backend/app/routers/workshops.py` |
| 14 | POST | `/api/workshops/{workshop_id}/favorite` | 必須 | お気に入り登録（201。登録済みでもエラーにしない） | `backend/app/routers/workshops.py` |
| 15 | DELETE | `/api/workshops/{workshop_id}/favorite` | 必須 | お気に入り解除（204。未登録でもエラーにしない） | `backend/app/routers/workshops.py` |
| 16 | GET | `/api/reservations/me` | 必須 | 自分の予約一覧（作成日時降順） | `backend/app/routers/reservations.py` |
| 17 | DELETE | `/api/reservations/{reservation_id}` | 必須（予約者本人） | 予約キャンセル（status を canceled に更新、204） | `backend/app/routers/reservations.py` |
| 18 | GET | `/api/favorites` | 必須 | 自分のお気に入り一覧（登録日時降順） | `backend/app/routers/favorites.py` |
| 19 | GET | `/api/facilitators/{user_id}` | 不要 | 主催者プロフィール（facilitator / admin 以外は 404） | `backend/app/routers/facilitators.py` |
| 20 | GET | `/api/notifications` | 必須 | 自分の通知一覧（作成日時降順） | `backend/app/routers/notifications.py` |
| 21 | GET | `/api/notifications/unread-count` | 必須 | 未読件数 `{count}` | `backend/app/routers/notifications.py` |
| 22 | POST | `/api/notifications/{notification_id}/read` | 必須（宛先本人） | 通知を既読化 | `backend/app/routers/notifications.py` |
| 23 | POST | `/api/notifications/read-all` | 必須 | 未読通知をすべて既読化（204） | `backend/app/routers/notifications.py` |
| 24 | GET | `/api/health` | 不要 | ヘルスチェック | `backend/app/main.py` |
| 25 | GET | `/api/uploads/{path}` | 不要 | アップロード画像の静的配信（`StaticFiles`） | `backend/app/main.py` |

### フロントエンド API クライアントとの対応

| フロントエンド関数 | API | ファイル |
|---|---|---|
| `login` / `register` / `fetchCurrentUser` | No.2 / No.1 / No.3 | `frontend/src/api/auth.ts` |
| `updateMe` / `getFacilitatorProfile` | No.4 / No.19 | `frontend/src/api/users.ts` |
| `listWorkshops` / `getWorkshop` / `createWorkshop` / `updateWorkshop` / `deleteWorkshop` | No.5 / 6 / 7 / 8 / 9 | `frontend/src/api/workshops.ts` |
| `uploadWorkshopImage` / `deleteWorkshopImage` | No.10 / 11 | `frontend/src/api/workshops.ts` |
| `addFavorite` / `removeFavorite` | No.14 / 15 | `frontend/src/api/workshops.ts` |
| `listMyFavorites` | No.18 | `frontend/src/api/favorites.ts` |
| `reserveWorkshop` / `listWorkshopReservations` / `listMyReservations` / `cancelReservation` | No.12 / 13 / 16 / 17 | `frontend/src/api/reservations.ts` |
| `listNotifications` / `getUnreadNotificationCount` / `markNotificationRead` / `markAllNotificationsRead` | No.20 / 21 / 22 / 23 | `frontend/src/api/notifications.ts` |

- No.24（health）はフロントエンドから呼ばれていない。

---

参照したファイル:
- `backend/app/main.py`
- `backend/app/routers/auth.py`
- `backend/app/routers/workshops.py`
- `backend/app/routers/reservations.py`
- `backend/app/routers/favorites.py`
- `backend/app/routers/facilitators.py`
- `backend/app/routers/notifications.py`
- `backend/app/services/workshops.py`
- `backend/app/services/notifications.py`
- `backend/app/services/uploads.py`
- `backend/app/core/deps.py`
- `backend/app/schemas/user.py`
- `backend/app/schemas/workshop.py`
- `backend/app/schemas/reservation.py`
- `backend/scripts/set_role.py`
- `frontend/src/App.tsx`
- `frontend/src/api/*.ts`
- `frontend/src/components/Navbar.tsx`
- `frontend/src/components/FavoriteButton.tsx`
- `frontend/src/components/ProtectedRoute.tsx`
- `frontend/src/components/auth/LoginForm.tsx`
- `frontend/src/components/auth/RegisterForm.tsx`
- `frontend/src/context/AuthContext.tsx`
- `frontend/src/context/NotificationContext.tsx`
- `frontend/src/pages/**/*.tsx`
