# 画面遷移図

最終更新日: 2026-09-25

各画面間の遷移を、きっかけ（リンク・ボタン・処理結果）とともに示す。画面数が多いため「共通ナビゲーション」「認証」「利用者向け」「主催者向け」の 4 つの図に分けている。遷移は `Link` / `navigate()` / `<Navigate>` のコードから読み取った。

## 1. 共通ナビゲーション（Navbar）とガード

```mermaid
flowchart LR
    ANY(["任意の画面"])
    LIST["ワークショップ一覧<br/>/"]
    FAV["お気に入り<br/>/favorites"]
    NOTI["通知<br/>/notifications"]
    SET["設定<br/>/settings"]
    LOGIN["ログイン（種別選択）<br/>/login"]
    REG["新規登録（種別選択）<br/>/register"]
    LOGIN_P["参加者ログイン<br/>/login/participant"]
    LOGIN_F["主催者ログイン<br/>/login/facilitator"]
    NF["ページが見つかりません<br/>/404"]
    AUTHED(["ログイン必須の画面<br/>/workshops/:id/reserve, /reservations,<br/>/favorites, /notifications,<br/>/settings, /settings/profile"])
    MNG(["主催者・管理者の画面<br/>/manage 配下"])

    ANY -->|"ロゴ / ワークショップ一覧"| LIST
    ANY -->|"お気に入り（ログイン時）"| FAV
    ANY -->|"🔔 通知（ログイン時）"| NOTI
    ANY -->|"{名前}さん（ログイン時）"| SET
    ANY -->|"ログアウト"| LOGIN
    ANY -->|"ログイン（未ログイン時）"| LOGIN
    ANY -->|"新規登録（未ログイン時）"| REG
    ANY -->|"未定義パス *"| NF
    NF -->|"トップに戻る"| LIST

    AUTHED -->|"未ログイン: リダイレクト<br/>state.from = 元のパス"| LOGIN_P
    MNG -->|"未ログイン: リダイレクト<br/>state.from = 元のパス"| LOGIN_F
    MNG -->|"participant でアクセス: リダイレクト"| LIST
```

根拠:

- Navbar のリンクとログアウト後の `navigate('/login')`: `frontend/src/components/Navbar.tsx:10-13, 18-75`
- 未ログイン時のリダイレクト（`state: { from: location.pathname }`）とロール不足時の `/` へのリダイレクト: `frontend/src/components/ProtectedRoute.tsx:18-24`
- ログイン先の出し分け（`loginPath`）: `frontend/src/App.tsx:39, 48`
- 未定義パス → `/404`: `frontend/src/App.tsx:55-56`

## 2. 認証（ログイン・新規登録）

```mermaid
flowchart LR
    LOGIN["ログイン（種別選択）<br/>/login"]
    REG["新規登録（種別選択）<br/>/register"]
    LOGIN_P["参加者ログイン<br/>/login/participant"]
    LOGIN_F["主催者ログイン<br/>/login/facilitator"]
    REG_P["参加者登録<br/>/register/participant"]
    REG_F["主催者登録<br/>/register/facilitator"]
    FROM(["state.from の画面<br/>（ログイン前にアクセスしようとした画面）"])
    LIST["ワークショップ一覧<br/>/"]
    MANAGE["ワークショップ管理<br/>/manage"]

    LOGIN -->|"参加者としてログイン"| LOGIN_P
    LOGIN -->|"主催者としてログイン"| LOGIN_F
    REG -->|"参加者として登録"| REG_P
    REG -->|"主催者として登録"| REG_F

    LOGIN_P -->|"ログイン成功（state.from あり）"| FROM
    LOGIN_P -->|"ログイン成功（state.from なし）"| LIST
    LOGIN_P -->|"失敗 / participant 以外のアカウント<br/>（ログアウトしてエラー表示）"| LOGIN_P
    LOGIN_P -->|"参加者として新規登録"| REG_P
    LOGIN_P -->|"主催者としてログインする方はこちら<br/>（state を引き継ぐ）"| LOGIN_F

    LOGIN_F -->|"ログイン成功（state.from あり）"| FROM
    LOGIN_F -->|"ログイン成功（state.from なし）"| MANAGE
    LOGIN_F -->|"失敗 / facilitator・admin 以外<br/>（ログアウトしてエラー表示）"| LOGIN_F
    LOGIN_F -->|"主催者として新規登録"| REG_F
    LOGIN_F -->|"参加者としてログインする方はこちら<br/>（state を引き継ぐ）"| LOGIN_P

    REG_P -->|"登録成功（自動ログイン）"| LIST
    REG_P -->|"失敗（エラー表示）"| REG_P
    REG_P -->|"参加者ログイン"| LOGIN_P
    REG_P -->|"主催者として登録する方はこちら"| REG_F

    REG_F -->|"登録成功（自動ログイン）"| MANAGE
    REG_F -->|"失敗（エラー表示）"| REG_F
    REG_F -->|"主催者ログイン"| LOGIN_F
    REG_F -->|"参加者として登録する方はこちら"| REG_P
```

補足:

- ログイン成功時の遷移先は `location.state.from ?? defaultRedirect` で、`replace: true` で遷移する（`frontend/src/components/auth/LoginForm.tsx:55-56`）。`defaultRedirect` は参加者ログインが `/`、主催者ログインが `/manage`（`frontend/src/pages/auth/ParticipantLoginPage.tsx:11`、`frontend/src/pages/auth/FacilitatorLoginPage.tsx:11`）。
- ログインしたアカウントのロールが `allowedRoles` に含まれない場合は、即座に `logout()` してエラーメッセージを表示し、画面に留まる（`frontend/src/components/auth/LoginForm.tsx:50-54`）。
- 登録成功時は `register` → 自動で `login` し、`afterRegisterPath` へ `replace: true` で遷移する。登録後の遷移では `state.from` は参照しない（`frontend/src/context/AuthContext.tsx:53-56`、`frontend/src/components/auth/RegisterForm.tsx:44-45`）。
- 「参加者ログイン ⇔ 主催者ログイン」の切替リンクは `state={location.state}` で現在の state を引き継ぐ。このため、ログイン必須画面から参加者ログインへリダイレクトされた主催者が主催者ログインに切り替えても、ログイン後は元の画面（`state.from`）へ戻る（`frontend/src/components/auth/LoginForm.tsx:109-112`）。

## 3. 利用者向け（閲覧・予約・お気に入り・通知・設定）

```mermaid
flowchart LR
    LIST["ワークショップ一覧<br/>/"]
    DETAIL["ワークショップ詳細<br/>/workshops/:id"]
    FACI["主催者プロフィール<br/>/facilitators/:id"]
    RESERVE["参加者情報の入力<br/>/workshops/:id/reserve"]
    MYRSV["参加予定のワークショップ<br/>/reservations"]
    FAV["お気に入り<br/>/favorites"]
    NOTI["通知<br/>/notifications"]
    SET["設定<br/>/settings"]
    PROF["プロフィール編集<br/>/settings/profile"]
    MANAGE["ワークショップ管理<br/>/manage"]
    LOGIN_P["参加者ログイン<br/>/login/participant"]
    GMAP(["Google マップ<br/>（外部・新しいタブ）"])

    LIST -->|"ワークショップカード"| DETAIL
    LIST -->|"検索（同一画面で再取得）"| LIST
    FAV -->|"ワークショップカード"| DETAIL
    FACI -->|"ワークショップカード"| DETAIL

    DETAIL -->|"主催: {主催者名}"| FACI
    DETAIL -->|"地図で見る（オフライン開催時）"| GMAP
    DETAIL -->|"予約する（ログイン時）"| RESERVE
    DETAIL -->|"ログインして予約する<br/>state.from = /workshops/:id/reserve"| LOGIN_P
    DETAIL -->|"お気に入りボタン（公開中・未ログイン時）<br/>state.from = /workshops/:id"| LOGIN_P
    DETAIL -->|"参加予定のワークショップ（予約済み時）"| MYRSV

    RESERVE -->|"この内容で予約を確定する: 成功<br/>state.justReserved = タイトル"| MYRSV
    RESERVE -->|"確定: 失敗（エラー表示）"| RESERVE
    RESERVE -->|"キャンセル（入力変更時は確認ダイアログ）"| DETAIL
    RESERVE -->|"予約済み: 参加予定のワークショップを見る"| MYRSV
    RESERVE -->|"満員: ワークショップ詳細に戻る"| DETAIL
    RESERVE -->|"中止・非公開: ワークショップ詳細に戻る"| DETAIL

    MYRSV -->|"ワークショップ名"| DETAIL
    MYRSV -->|"キャンセル（確認ダイアログ→再取得）"| MYRSV

    NOTI -->|"通知カード（未読なら既読化）"| DETAIL
    NOTI -->|"すべて既読にする"| NOTI

    SET -->|"プロフィール編集"| PROF
    SET -->|"ワークショップの管理<br/>（facilitator / admin のみ表示）"| MANAGE
    SET -->|"予約履歴・参加履歴"| MYRSV
    PROF -->|"保存する（同一画面で完了表示）"| PROF
```

補足:

- 一覧・お気に入り・主催者プロフィール画面のお気に入りボタン（`FavoriteButton`）も、未ログイン時は `/login/participant`（`state.from = /workshops/:id`）へ遷移する。カード自体のリンク遷移は `preventDefault` / `stopPropagation` で抑止される（`frontend/src/components/FavoriteButton.tsx:21-28`）。
- ワークショップ詳細の予約ボタンは、公開中（`status === 'published'`）のときのみ表示され、満員または予約済みのときは無効化される（`frontend/src/pages/WorkshopDetailPage.tsx:157-171`）。
- 予約確定後、参加予定画面の上部に「「{タイトル}」への参加登録が完了しました。」を表示する（`frontend/src/pages/ReservationFormPage.tsx:78`、`frontend/src/pages/MyReservationsPage.tsx:16, 63-67`）。
- 詳細画面・予約画面・主催者プロフィール画面は、URL の `:id` が正の整数でない場合、API を呼ばずにエラーメッセージを表示する（`parseIdParam`。`frontend/src/pages/WorkshopDetailPage.tsx:28-33`、`frontend/src/pages/ReservationFormPage.tsx:28-33`、`frontend/src/pages/FacilitatorProfilePage.tsx:18-23`、`frontend/src/utils/params.ts`）。`/404` へは遷移しない。
- 中止されたワークショップの詳細は、そのワークショップを予約したことのあるユーザーも閲覧できる。このため、通知一覧（中止のお知らせ）や参加予定一覧からのリンクで、中止のバナー付きの詳細画面を表示できる（`backend/app/routers/workshops.py:102-110`、`frontend/src/pages/WorkshopDetailPage.tsx:88-92`）。
- 詳細画面のお気に入りボタンは公開中のときのみ表示される（`frontend/src/pages/WorkshopDetailPage.tsx:95-97`）。

## 4. 主催者向け（ワークショップ管理）

```mermaid
flowchart LR
    SET["設定<br/>/settings"]
    MANAGE["ワークショップ管理<br/>/manage"]
    NEW["ワークショップ新規作成<br/>/manage/workshops/new"]
    EDIT["ワークショップ編集<br/>/manage/workshops/:id/edit"]
    RSV["予約状況<br/>/manage/workshops/:id/reservations"]
    LOGIN_F["主催者ログイン<br/>/login/facilitator"]
    REG_F["主催者登録<br/>/register/facilitator"]
    GMAP(["Google マップ<br/>（外部・新しいタブ）"])

    LOGIN_F -->|"ログイン成功（state.from なし）"| MANAGE
    REG_F -->|"登録成功"| MANAGE
    SET -->|"ワークショップの管理"| MANAGE

    MANAGE -->|"新規作成"| NEW
    MANAGE -->|"編集"| EDIT
    MANAGE -->|"予約状況"| RSV
    MANAGE -->|"中止する（確認ダイアログ→再取得）"| MANAGE
    MANAGE -->|"削除（予約者がいない場合のみ有効<br/>確認ダイアログ→再取得）"| MANAGE

    NEW -->|"下書きとして保存 / 公開する: 成功"| MANAGE
    NEW -->|"保存: 入力エラー・API 失敗（エラー表示）"| NEW
    NEW -->|"キャンセル（入力変更時は確認ダイアログ）"| MANAGE
    NEW -->|"地図で確認（オフライン開催時）"| GMAP

    EDIT -->|"下書きとして保存 / 公開する: 成功"| MANAGE
    EDIT -->|"保存: 入力エラー・API 失敗（エラー表示）"| EDIT
    EDIT -->|"キャンセル（入力変更時は確認ダイアログ）"| MANAGE
    EDIT -->|"地図で確認（オフライン開催時）"| GMAP
```

補足:

- 「中止する」は開催予定タブかつ `status !== 'canceled'` の行にのみ表示される。実体は `PUT /api/workshops/{id}` で `status: 'canceled'` を送る処理（`frontend/src/pages/manage/ManageWorkshopsPage.tsx:54-73, 156-163`）。
- 保存時は、ワークショップ本体の保存（作成 / 更新）が成功した後に、画像の差し替え（`POST /image`）または削除（`DELETE /image`）を行ってから `/manage` へ遷移する（`frontend/src/pages/manage/WorkshopFormPage.tsx:146-162`）。
- 予約状況画面にはリンク・ボタンがなく、戻る導線は Navbar またはブラウザバックのみ（`frontend/src/pages/manage/WorkshopReservationsPage.tsx`）。

---

参照したファイル:
- `frontend/src/App.tsx`
- `frontend/src/components/Navbar.tsx`
- `frontend/src/components/ProtectedRoute.tsx`
- `frontend/src/components/FavoriteButton.tsx`
- `frontend/src/components/WorkshopCard.tsx`
- `frontend/src/components/auth/LoginForm.tsx`
- `frontend/src/components/auth/RegisterForm.tsx`
- `frontend/src/context/AuthContext.tsx`
- `frontend/src/pages/WorkshopListPage.tsx`
- `frontend/src/pages/WorkshopDetailPage.tsx`
- `frontend/src/pages/ReservationFormPage.tsx`
- `frontend/src/pages/MyReservationsPage.tsx`
- `frontend/src/pages/FavoritesPage.tsx`
- `frontend/src/pages/NotificationsPage.tsx`
- `frontend/src/pages/SettingsPage.tsx`
- `frontend/src/pages/FacilitatorProfilePage.tsx`
- `frontend/src/pages/NotFoundPage.tsx`
- `frontend/src/pages/auth/*.tsx`
- `frontend/src/pages/manage/*.tsx`
- `frontend/src/utils/params.ts`
