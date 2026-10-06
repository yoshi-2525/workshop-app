# 画面遷移図

最終更新日: 2026-10-06

> 注記（2026-10-05）: 問い合わせ（`/inquiries`、`/inquiries/:id`、`/workshops/:id/inquiry`）・ヘルプ・ガイド（`/help` 配下、`/rules`、`/about`）の画面の中での遷移は本書ではまだ詳しく描いていない（画面への入口のみ記載）。

各画面間の遷移を、きっかけ（リンク・ボタン・処理結果）とともに示す。画面数が多いため「共通ナビゲーション」「認証」「利用者向け」「オンライン決済（参加者）」「主催者向け」「売上と振込（主催者・運営）」の 6 つの図に分けている。遷移は `Link` / `navigate()` / `<Navigate>` / `window.location.assign()` のコードから読み取った。

## 1. 共通ナビゲーション（Navbar・フッター）とガード

```mermaid
flowchart LR
    ANY(["任意の画面"])
    LIST["ワークショップ一覧<br/>/"]
    RULES["対話のルール<br/>/rules"]
    NEWWS["ワークショップ新規作成<br/>/manage/workshops/new"]
    INQ["問い合わせ一覧<br/>/inquiries"]
    NOTI["通知<br/>/notifications"]
    SET["マイページ<br/>/me"]
    ABOUT["TAIWA について<br/>/about"]
    HELP["ヘルプ・規約<br/>/help"]
    LOGIN["ログイン（種別選択）<br/>/login"]
    REG["新規登録（種別選択）<br/>/register"]
    LOGIN_P["参加者ログイン<br/>/login/participant"]
    LOGIN_F["主催者ログイン<br/>/login/facilitator"]
    NF["ページが見つかりません<br/>/404"]
    AUTHED(["ログイン必須の画面<br/>/workshops/:id/reserve, /reservations 配下,<br/>/favorites, /following, /notifications,<br/>/inquiries 配下, /workshops/:id/inquiry, /me 配下"])
    MNG(["主催者・管理者の画面<br/>/manage 配下（/manage/payout を含む）"])
    ADM(["管理者のみの画面<br/>/manage/payout-requests"])

    ANY -->|"ロゴ「TAIWA」/ さがす"| LIST
    ANY -->|"対話のルール"| RULES
    ANY -->|"対話を開く（facilitator / admin）"| NEWWS
    ANY -->|"問い合わせアイコン（ログイン時）"| INQ
    ANY -->|"通知アイコン（ログイン時）"| NOTI
    ANY -->|"プロフィールアイコン（ログイン時）"| SET
    ANY -->|"ログイン（未ログイン時）"| LOGIN
    ANY -->|"新規登録（未ログイン時）"| REG
    ANY -->|"フッター: TAIWA について"| ABOUT
    ANY -->|"フッター: ヘルプ・規約"| HELP
    ANY -->|"未定義パス *"| NF
    NF -->|"トップに戻る"| LIST

    AUTHED -->|"未ログイン: リダイレクト<br/>state.from = 元のパス + クエリ"| LOGIN_P
    MNG -->|"未ログイン: リダイレクト<br/>state.from = 元のパス + クエリ"| LOGIN_F
    MNG -->|"participant でアクセス: リダイレクト"| LIST
    ADM -->|"未ログイン: リダイレクト<br/>state.from = 元のパス + クエリ"| LOGIN_F
    ADM -->|"participant / facilitator でアクセス: リダイレクト"| LIST
```

根拠:

- Navbar のリンク: `frontend/src/components/layout/Navbar.tsx:56-115`
- フッターのリンク: `frontend/src/components/layout/Layout.tsx:13-28`
- 旧 URL `/settings`・`/settings/profile` は `/me`・`/me/profile` へ `<Navigate replace>`（`frontend/src/App.tsx:77-79`）
- 未ログイン時のリダイレクト（`state: { from: location.pathname + location.search }`）とロール不足時の `/` へのリダイレクト: `frontend/src/components/layout/ProtectedRoute.tsx:19-26`
- ログイン先の出し分け（`loginPath`）: `frontend/src/App.tsx:63, 82, 90`
- 未定義パス → `/404`: `frontend/src/App.tsx:94-95`

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

- ログイン成功時の遷移先は `location.state.from ?? defaultRedirect` で、`replace: true` で遷移する。`defaultRedirect` は参加者ログインが `/`、主催者ログインが `/manage`（`frontend/src/components/auth/LoginForm.tsx`、`frontend/src/pages/auth/ParticipantLoginPage.tsx`、`frontend/src/pages/auth/FacilitatorLoginPage.tsx`）。
- ログインしたアカウントのロールが `allowedRoles` に含まれない場合は、即座に `logout()` してエラーメッセージを表示し、画面に留まる（`frontend/src/components/auth/LoginForm.tsx`）。
- 登録成功時は `register` → 自動で `login` し、`afterRegisterPath` へ `replace: true` で遷移する。登録後の遷移では `state.from` は参照しない（`frontend/src/context/AuthContext.tsx`、`frontend/src/components/auth/RegisterForm.tsx`）。
- 「参加者ログイン ⇔ 主催者ログイン」の切替リンクは `state={location.state}` で現在の state を引き継ぐ。このため、ログイン必須画面から参加者ログインへリダイレクトされた主催者が主催者ログインに切り替えても、ログイン後は元の画面（`state.from`）へ戻る（`frontend/src/components/auth/LoginForm.tsx`）。

## 3. 利用者向け（閲覧・予約・お気に入り・フォロー・通知・マイページ）

```mermaid
flowchart LR
    LIST["ワークショップ一覧<br/>/"]
    DETAIL["ワークショップ詳細<br/>/workshops/:id"]
    FACI["主催者プロフィール<br/>/facilitators/:id"]
    RESERVE["参加者情報の入力<br/>/workshops/:id/reserve"]
    MYRSV["参加予定のワークショップ<br/>/reservations"]
    HIST["予約・参加履歴<br/>/reservations/history"]
    FAV["お気に入り<br/>/favorites"]
    FOLLOWING["フォロー中の主催者<br/>/following"]
    NOTI["通知<br/>/notifications"]
    WSINQ["主催者への問い合わせ<br/>/workshops/:id/inquiry"]
    INQ["問い合わせ一覧<br/>/inquiries"]
    SET["マイページ<br/>/me"]
    PROF["プロフィール編集<br/>/me/profile"]
    MANAGE["ワークショップ管理<br/>/manage"]
    PAYOUT["売上と振込<br/>/manage/payout"]
    PAYREQ["振込の申請（運営）<br/>/manage/payout-requests"]
    DOCS["ヘルプ・規約の各文書<br/>/rules, /help/*"]
    LOGIN_P["参加者ログイン<br/>/login/participant"]
    GMAP(["Google マップ<br/>（外部・新しいタブ）"])

    LIST -->|"ワークショップカード"| DETAIL
    LIST -->|"検索（同一画面で再取得）"| LIST
    FAV -->|"ワークショップカード"| DETAIL
    FACI -->|"ワークショップカード"| DETAIL

    DETAIL -->|"主催者: {主催者名}"| FACI
    DETAIL -->|"主催者に問い合わせる（ログイン時）"| WSINQ
    DETAIL -->|"主催者に問い合わせる（未ログイン時）<br/>state.from = /workshops/:id/inquiry"| LOGIN_P
    DETAIL -->|"届いた問い合わせ（自分のワークショップ）"| INQ

    FACI -->|"フォローする / フォロー中（押すと解除）<br/>同一画面でボタン表示を切替"| FACI
    FACI -->|"ログインしてフォロー（未ログイン時）<br/>state.from = /facilitators/:id"| LOGIN_P
    FOLLOWING -->|"ワークショップカード<br/>（開催予定のワークショップ）"| DETAIL
    FOLLOWING -->|"主催者名（フォローしている主催者）"| FACI
    FOLLOWING -->|"フォロー中（押すと解除）<br/>両方の一覧を再取得"| FOLLOWING
    DETAIL -->|"地図で見る（オフライン開催時）"| GMAP
    DETAIL -->|"予約する / お支払いを再開する（ログイン時）"| RESERVE
    DETAIL -->|"ログインして予約する<br/>state.from = /workshops/:id/reserve"| LOGIN_P
    DETAIL -->|"お気に入りボタン（公開中・未ログイン時）<br/>state.from = /workshops/:id"| LOGIN_P
    DETAIL -->|"参加予定のワークショップ（予約済み時）"| MYRSV
    DETAIL -->|"キャンセルについて: キャンセルポリシー<br/>（有料のみ）"| DOCS
    RESERVE -->|"キャンセルについて: キャンセルポリシー<br/>（有料のみ）"| DOCS

    RESERVE -->|"予約を確定する: 成功（当日払い・無料）<br/>state.justReserved = タイトル"| MYRSV
    RESERVE -->|"確定: 失敗（エラー表示）"| RESERVE
    RESERVE -->|"キャンセル（確認なし）"| DETAIL
    RESERVE -->|"予約済み: 参加予定のワークショップを見る"| MYRSV
    RESERVE -->|"満員・締切後・開始済み・中止・非公開・<br/>主催者による取消済み: ワークショップ詳細に戻る"| DETAIL

    MYRSV -->|"ワークショップ名（カード全体）"| DETAIL
    MYRSV -->|"主催者に問い合わせる（確定済み）"| WSINQ
    MYRSV -->|"お支払いを再開する（お支払い待ち）"| RESERVE
    HIST -->|"ワークショップ名（カード全体）"| DETAIL
    HIST -->|"参加履歴 / 予約履歴（タブ切替）"| HIST

    NOTI -->|"通知カード（未読なら既読化）"| DETAIL
    NOTI -->|"すべて既読にする"| NOTI

    SET -->|"参加予定のワークショップ"| MYRSV
    SET -->|"予約・参加履歴"| HIST
    SET -->|"お気に入り"| FAV
    SET -->|"フォロー中の主催者のワークショップ"| FOLLOWING
    SET -->|"ワークショップの管理<br/>（facilitator / admin のみ表示）"| MANAGE
    SET -->|"売上と振込<br/>（facilitator / admin のみ表示）"| PAYOUT
    SET -->|"振込の申請(運営)<br/>（admin のみ表示）"| PAYREQ
    SET -->|"問い合わせ"| INQ
    SET -->|"プロフィール編集"| PROF
    SET -->|"ヘルプ・規約の各カード"| DOCS
    SET -->|"ログアウト"| LOGIN_OUT["ログイン（種別選択）<br/>/login"]
    PROF -->|"保存する（同一画面で完了表示）"| PROF
```

補足:

- 参加者は自分で予約を取り消せない。参加予定画面には「キャンセルをご希望の場合は、ワークショップの主催者にご連絡ください。」と表示し、取消ボタンはない（`frontend/src/pages/reservations/MyReservationsPage.tsx:163-181`）。取消は主催者が予約状況画面から行う（4 章）。
- 一覧・お気に入り・主催者プロフィール画面のお気に入りボタン（`FavoriteButton`）も、未ログイン時は `/login/participant`（`state.from = /workshops/:id`）へ遷移する（`frontend/src/components/workshop/FavoriteButton.tsx`）。
- ワークショップ詳細の予約ボタンは公開中（`status === 'published'`）のときのみ表示され、予約済み・主催者による取消済みのときはボタンを出さずに案内文を出す。満員・締切後・開始済みのときは無効化される。オンライン決済の支払い待ち（`viewer.is_payment_pending`）なら「お支払いを再開する」になる（`frontend/src/pages/workshops/WorkshopDetailPage.tsx:34-47, 229-264`）。
- 有料のワークショップでは、詳細画面と予約フォームの「キャンセルについて」（本サービス共通のキャンセルポリシーの要約）に、キャンセルポリシー（`/help/cancellation-policy`）へのリンクがある。同じタブで遷移する（`frontend/src/components/workshop/CancellationPolicy.tsx`）。
- 予約できるかの判定は `getReservationBlocker()`（判定の順: 非公開 → 予約済み → 主催者による取消 → 開始済み → 締切後 → 満員。支払い待ちの本人は満員でも予約可能扱い）を詳細と予約フォームで共通に使う（`frontend/src/utils/workshop.ts:67-88`）。
- 予約確定後（当日払い・無料）、参加予定画面の上部に「「{タイトル}」への参加登録が完了しました。」を表示する（`frontend/src/pages/reservations/ReservationFormPage.tsx:88-95`、`frontend/src/pages/reservations/MyReservationsPage.tsx:163-177`）。
- 詳細画面・予約画面・主催者プロフィール画面・決済完了画面は、URL の `:id` が正の整数でない場合、API を呼ばずにエラーメッセージを表示する（`parseIdParam`。`frontend/src/utils/params.ts`）。`/404` へは遷移しない。
- 中止されたワークショップの詳細は、そのワークショップを予約したことのあるユーザーも閲覧できる（`backend/app/services/workshops.py:414-428`）。
- 主催者プロフィールのフォローボタン（`FollowButton`）は、表示中の主催者の role が `facilitator` のときだけ表示する。admin（運営）のページと自分自身のページでは表示しない（`frontend/src/components/facilitator/FollowButton.tsx`、`frontend/src/utils/user.ts`）。
- フォロー中の主催者画面でフォローを解除すると、ワークショップ・主催者の両一覧を再取得する（`frontend/src/pages/me/FollowingPage.tsx`）。
- マイページのメニューのリンクには `useBackState('マイページ')` の state を付ける（`frontend/src/pages/me/MyPage.tsx:16-25`）。

## 4. オンライン決済（参加者）

オンライン決済（`payment_method = 'online'` かつ有料）のワークショップを予約するときの遷移。Stripe の画面はアプリ外。

```mermaid
flowchart LR
    DETAIL["ワークショップ詳細<br/>/workshops/:id"]
    RESERVE["参加者情報の入力<br/>/workshops/:id/reserve"]
    PENDING["参加者情報の入力（支払い待ちの表示）<br/>/workshops/:id/reserve<br/>「お支払いが完了していません」"]
    CHECKOUT(["Stripe Checkout<br/>（checkout.stripe.com）"])
    DONE["お支払いの確認<br/>/reservations/:id/payment/complete"]
    MYRSV["参加予定のワークショップ<br/>/reservations"]

    DETAIL -->|"予約する"| RESERVE
    RESERVE -->|"お支払いへ進む: 成功<br/>（席を 32 分確保し checkout_url へ移動）"| CHECKOUT
    RESERVE -->|"お支払いへ進む: 失敗<br/>（エラー表示し、予約状態を取り直す）"| RESERVE
    CHECKOUT -->|"支払い完了（success_url）"| DONE
    CHECKOUT -->|"戻る（cancel_url）<br/>?payment=canceled"| PENDING
    DETAIL -->|"お支払いを再開する（支払い待ち時）"| PENDING
    MYRSV -->|"お支払いを再開する（支払い待ち時）"| PENDING
    PENDING -->|"お支払いを再開する: 成功<br/>（同じ Checkout の URL）"| CHECKOUT
    PENDING -->|"お支払いを再開する: 状態が変わっていた<br/>（409 をエラー表示）"| PENDING
    PENDING -->|"予約をやめる（確認ダイアログ）→ 取りやめ成功<br/>「お支払いを取りやめ…」を表示"| RESERVE
    DONE -->|"確定: 参加予定のワークショップを見る"| MYRSV
    DONE -->|"確認に時間がかかる: 参加予定のワークショップを見る"| MYRSV
    DONE -->|"確認に時間がかかる: もう一度確認する"| DONE
    DONE -->|"期限切れ・返金・中止: ワークショップ詳細に戻る"| DETAIL
```

補足:

- 予約の送信（`POST /api/workshops/{id}/reservations`）の応答に `checkout_url` があれば、Stripe のページ（`https` かつホストが `checkout.stripe.com`）であることを確かめてから `window.location.assign()` で移動する。なければ（当日払い・無料）`/reservations` へ遷移する（`frontend/src/api/reservations.ts:17-27`、`frontend/src/utils/payment.ts:32-45`、`frontend/src/pages/reservations/ReservationFormPage.tsx:65-98`）。
- Checkout の戻り先はバックエンドが決める: `success_url = {FRONTEND_BASE_URL}/reservations/{予約ID}/payment/complete`、`cancel_url = {FRONTEND_BASE_URL}/workshops/{ワークショップID}/reserve?payment=canceled`（`backend/app/services/payments.py:98-99`）。Checkout は運営の Stripe アカウント上に作成する（主催者ごとの連結アカウントは使わない）。
- 予約フォームは、閲覧者が支払い待ち（`viewer.is_payment_pending`）で他に予約を妨げる理由がなければ、入力欄の代わりに「お支払いが完了していません」のパネル（`PendingPaymentPanel`）を表示する。`?payment=canceled` のときは「お支払いの画面から戻りました。」を添える（`frontend/src/pages/reservations/ReservationFormPage.tsx:100-162, 230-241`）。
- 「お支払いを再開する」は予約 API をもう一度呼ぶ。支払い待ちのまま呼ぶと、バックエンドは同じ支払いの Checkout URL を返す。Checkout がもう開いていない（支払い済み・期限切れ）ときは状態を反映したうえで 409「お支払いの状態が変わりました。参加予定のワークショップでご確認ください」を返す（`backend/app/services/reservations.py:168-175, 323-337`）。
- 「予約をやめる」は自分の予約一覧から支払い待ちの予約を探して `POST /api/reservations/{id}/abandon-payment` を呼ぶ。見つからなければ（期限切れ・支払い済み）何もせずに画面を取り直す（`frontend/src/pages/reservations/ReservationFormPage.tsx:119-134`）。
- ブラウザの「戻る」で Stripe から予約フォームがそのまま復元された（`pageshow` の `persisted`）ときは、ボタンを押せる状態に戻して予約状態を取り直す（`frontend/src/pages/reservations/ReservationFormPage.tsx:76-86`）。
- 決済完了画面は `GET /api/reservations/{id}` を最大 10 回、2 秒間隔で取り直して予約の確定を待つ（バックエンドは支払い待ちなら Stripe から状態を読み直してから返す）。表示は次の 6 種類（`frontend/src/pages/reservations/PaymentCompletePage.tsx:12-43`、`backend/app/routers/reservations.py:40-51`）。

| 状態 | 条件 | メッセージ（要旨） | 遷移の導線 |
|---|---|---|---|
| 確認中 | 予約が `pending_payment`（10 回未満） | お支払いを確認しています。このままお待ちください。 | なし（自動で再確認） |
| 時間がかかっている | 10 回確認しても `pending_payment` | 確認が済むと、参加予定のワークショップに表示されます。 | 「参加予定のワークショップを見る」「もう一度確認する」 |
| 確定 | `confirmed` かつワークショップが中止でない | お支払いが完了し、「{タイトル}」への参加が確定しました。 | 「参加予定のワークショップを見る」 |
| 中止 | `confirmed` かつワークショップが中止 | お支払いは完了しましたが中止になりました。全額返金します。 | 「ワークショップ詳細に戻る」 |
| 返金 | それ以外で支払いが返金対象 | 満席などの理由で参加を確定できませんでした。全額返金します。 | 「ワークショップ詳細に戻る」 |
| 期限切れ | それ以外 | お支払いの期限が過ぎたため、予約は確定していません。 | 「ワークショップ詳細に戻る」 |

## 5. 主催者向け（ワークショップ管理）

```mermaid
flowchart LR
    SET["マイページ<br/>/me"]
    NAV(["Navbar「対話を開く」"])
    MANAGE["ワークショップ管理<br/>/manage"]
    NEW["ワークショップ新規作成<br/>/manage/workshops/new"]
    EDIT["ワークショップ編集<br/>/manage/workshops/:id/edit"]
    RSV["予約状況（予約・出欠）<br/>/manage/workshops/:id/reservations"]
    INQ["問い合わせ一覧（絞り込み）<br/>/inquiries?workshop_id=:id"]
    LOGIN_F["主催者ログイン<br/>/login/facilitator"]
    REG_F["主催者登録<br/>/register/facilitator"]
    GMAP(["Google マップ<br/>（外部・新しいタブ）"])

    LOGIN_F -->|"ログイン成功（state.from なし）"| MANAGE
    REG_F -->|"登録成功"| MANAGE
    SET -->|"ワークショップの管理"| MANAGE
    NAV --> NEW

    MANAGE -->|"開催予定 / 下書き / 開催履歴（タブ切替）"| MANAGE
    MANAGE -->|"新規作成"| NEW
    MANAGE -->|"編集（開催前かつ中止でないもの）"| EDIT
    MANAGE -->|"予約・出欠（下書き以外）"| RSV
    MANAGE -->|"問い合わせ・お知らせ（下書き以外）"| INQ
    MANAGE -->|"削除（下書きのみ。確認ダイアログ→再取得）"| MANAGE

    NEW -->|"下書きとして保存 / 公開する: 成功"| MANAGE
    NEW -->|"保存: 入力エラー・API 失敗（エラー表示）"| NEW
    NEW -->|"キャンセル（入力変更時は確認ダイアログ）"| MANAGE
    NEW -->|"地図で確認（オフライン開催時）"| GMAP

    EDIT -->|"下書きとして保存 / 公開する: 成功"| MANAGE
    EDIT -->|"保存: 入力エラー・API 失敗（エラー表示）"| EDIT
    EDIT -->|"キャンセル（入力変更時は確認ダイアログ）"| MANAGE
    EDIT -->|"中止する（公開中のみ表示<br/>確認ダイアログ→成功）"| MANAGE
    EDIT -->|"地図で確認（オフライン開催時）"| GMAP

    RSV -->|"参加をキャンセル（取消フォームを開く）<br/>→ 理由を選びキャンセルを確定する<br/>（同一画面で行を更新）"| RSV
    RSV -->|"出欠（未確認 / 出席 / 欠席）を切替"| RSV
```

補足:

- 「中止する」は編集画面の下部に表示される。実体は `POST /api/workshops/{id}/cancel`。確認文言は「このワークショップを中止にしますか?予約済みの参加者には中止のお知らせが自動で届きます。」で、オンライン決済のワークショップでは「オンラインで支払われた参加費は全額を返金します。その参加費は主催者の売上になりませんが、手数料の負担もありません。」（`FULL_REFUND_FEE_NOTE`）を追記する。フォームで編集中の内容は保存しない（`frontend/src/pages/manage/WorkshopFormPage.tsx:158-178`、`frontend/src/utils/payment.ts:30`）。
- 「削除」は下書きの行にのみ表示する。一度公開したもの（公開中・中止）は記録として残すため削除できない（`frontend/src/pages/manage/ManageWorkshopsPage.tsx:172-183`、`backend/app/routers/workshops.py:175-197`）。
- 支払方法の「オンライン決済(カード)」は、運営側でオンライン決済が有効（`GET /api/facilitators/me/payouts/summary` の `online_payment_available = true`）なときだけ選べる。主催者ごとの受け取り設定はなく、作成・編集画面から売上と振込の画面へのリンクもない。選べないときは「現在、オンライン決済はご利用いただけません。」を表示する（`frontend/src/pages/manage/WorkshopFormFields.tsx:48-133`）。
- 予約状況画面の取消フォーム（`CancelReservationForm`）は、理由（主催者の都合 / 参加者からの申し出）を選ぶとオンライン決済の返金額を事前に表示し、「キャンセルを確定する」で `POST /api/workshops/{id}/reservations/{rid}/cancel` を送る。成功すると行を差し替えて「{名前}さんの参加をキャンセルしました。」を表示する（`frontend/src/pages/manage/WorkshopReservationsPage.tsx:93-117`、`frontend/src/pages/manage/CancelReservationForm.tsx`）。
- 予約状況画面にはページ間を移動するリンクはなく、戻る導線は Navbar またはブラウザバックのみ。

## 6. 売上と振込（主催者・運営）

主催者が売上を確かめて振込を申請し、運営（admin）が銀行で振り込んだ結果を記録する流れ。アプリ外への移動はない（振込は運営が銀行で手動で行う）。

```mermaid
flowchart LR
    SET["マイページ<br/>/me"]
    PAYOUT["売上と振込<br/>/manage/payout"]
    FGL["主催者ガイドライン<br/>/help/facilitator-guidelines"]
    RSV["予約状況（予約・出欠）<br/>/manage/workshops/:id/reservations"]
    PAYREQ["振込の申請（運営）<br/>/manage/payout-requests"]
    MANAGE["ワークショップ管理<br/>/manage"]

    SET -->|"売上と振込<br/>（facilitator / admin）"| PAYOUT
    PAYOUT -->|"マイページに戻る"| SET
    PAYOUT -->|"主催者ガイドライン（説明文のリンク）"| FGL
    PAYOUT -->|"売上の明細: ワークショップ名"| RSV
    PAYOUT -->|"口座を登録する / 変更する<br/>（同一画面で「保存しました」）"| PAYOUT
    PAYOUT -->|"振込を申請する（確認ダイアログ→成功）<br/>同一画面で状況・履歴を取り直す"| PAYOUT
    PAYOUT -->|"振込の申請の履歴 / 売上の明細のページ送り"| PAYOUT

    SET -->|"振込の申請(運営)<br/>（admin のみ）"| PAYREQ
    PAYREQ -->|"ワークショップの管理に戻る"| MANAGE
    PAYREQ -->|"振込待ち / 振込済み / 取り下げ / すべて<br/>（絞り込みの切替）"| PAYREQ
    PAYREQ -->|"振込済みにする / 取り下げる<br/>（確認ダイアログ→成功で一覧を取り直す）"| PAYREQ
```

補足:

- 売上と振込の画面は、表示時に `GET /api/facilitators/me/payouts/summary`（売上の状況）、`/bank-account`（振込先口座）、`/requests`（申請の履歴。5 件ずつ）、`/earnings`（売上の明細。10 件ずつ）を取得する（`frontend/src/pages/manage/PayoutSettingsPage.tsx:32-87, 170-261`、`frontend/src/api/payouts.ts`）。
- 口座を保存すると、口座の表示を差し替えて売上の状況を取り直す（申請できるかが変わるため）。振込を申請すると、売上の状況と申請の履歴（1 ページ目）を取り直す（`frontend/src/pages/manage/PayoutSettingsPage.tsx:38-46`）。
- 「振込を申請する」は、口座が未登録・申請中のものがある・申請できる額が最低額未満のときは無効で、その理由をボタンの下に表示する（最終的な判定はバックエンドの 409）（`frontend/src/pages/manage/PayoutSettingsPage.tsx:24-30`、`backend/app/services/payouts.py:105-113`）。
- 振込の申請の画面（運営）は admin だけが開ける（`ProtectedRoute roles={['admin']}`。`frontend/src/App.tsx:90-92`）。facilitator が URL を直接開くと `/` へ、未ログインなら `/login/facilitator` へリダイレクトする。初期表示は「振込待ち」（`status=requested`）で、申請の古い順に 20 件ずつ表示する（`frontend/src/pages/manage/AdminPayoutRequestsPage.tsx:15-45`、`backend/app/services/payouts.py:245-250`）。
- 「振込済みにする」「取り下げる」は確認ダイアログの後に `POST /api/admin/payout-requests/{id}/paid`（または `/reject`）をメモとともに送る。処理して件数が減り今のページがなくなったら最後のページへ移る（`frontend/src/pages/manage/AdminPayoutRequestsPage.tsx:44-69`）。

---

参照したファイル:
- `frontend/src/App.tsx`
- `frontend/src/components/layout/Navbar.tsx`
- `frontend/src/components/layout/Layout.tsx`
- `frontend/src/components/layout/ProtectedRoute.tsx`
- `frontend/src/components/workshop/FavoriteButton.tsx`
- `frontend/src/components/workshop/CancellationPolicy.tsx`
- `frontend/src/components/facilitator/FollowButton.tsx`
- `frontend/src/components/auth/LoginForm.tsx`
- `frontend/src/components/auth/RegisterForm.tsx`
- `frontend/src/context/AuthContext.tsx`
- `frontend/src/pages/workshops/WorkshopDetailPage.tsx`
- `frontend/src/pages/reservations/ReservationFormPage.tsx`
- `frontend/src/pages/reservations/MyReservationsPage.tsx`
- `frontend/src/pages/reservations/PaymentCompletePage.tsx`
- `frontend/src/pages/me/MyPage.tsx`
- `frontend/src/pages/me/FollowingPage.tsx`
- `frontend/src/pages/manage/ManageWorkshopsPage.tsx`
- `frontend/src/pages/manage/WorkshopFormPage.tsx`
- `frontend/src/pages/manage/WorkshopFormFields.tsx`
- `frontend/src/pages/manage/WorkshopReservationsPage.tsx`
- `frontend/src/pages/manage/CancelReservationForm.tsx`
- `frontend/src/pages/manage/PayoutSettingsPage.tsx`
- `frontend/src/pages/manage/BankAccountForm.tsx`
- `frontend/src/pages/manage/AdminPayoutRequestsPage.tsx`
- `frontend/src/api/reservations.ts`
- `frontend/src/api/payouts.ts`
- `frontend/src/utils/payment.ts`
- `frontend/src/utils/workshop.ts`
- `frontend/src/utils/user.ts`
- `frontend/src/utils/params.ts`
- `frontend/src/pages/auth/*.tsx`
- `backend/app/services/payments.py`
- `backend/app/services/reservations.py`
- `backend/app/services/workshops.py`
- `backend/app/services/payouts.py`
- `backend/app/routers/reservations.py`
- `backend/app/routers/workshops.py`
