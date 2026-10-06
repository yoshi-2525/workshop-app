# 機能一覧表

最終更新日: 2026-10-06

TAIWA の機能をカテゴリごとに一覧化し、利用者（権限）・画面・API との対応を示す。画面を持たない機能（スケジューラ、Webhook、運用スクリプト等）も含む。別表として API エンドポイントの一覧を置く。

> 注記（2026-10-05）: 問い合わせ（`/api/inquiries` 系）、主催者のアイコン（`/api/auth/me/avatar`）、ヘルプ・ガイドの各画面、関連ワークショップの選び方の詳細は、本書ではまだ機能一覧として整理していない（API 一覧の一部のみ記載）。

## 凡例

- 利用者（権限）
  - **全員**: 未ログインを含むすべての利用者
  - **ログイン**: ログイン済みユーザー（participant / facilitator / admin のいずれでも可）
  - **主催者**: facilitator または admin
  - **管理者**: admin のみ
  - **システム**: 利用者操作によらず自動実行
  - **Stripe**: Stripe からの Webhook 呼び出し
- API のパスはすべて `/api` プレフィックス付き。
- カテゴリ略称: AUTH（認証）/ WS（ワークショップ閲覧）/ RSV（予約）/ PAY（オンライン決済）/ PAYOUT（売上と振込）/ FAV（お気に入り）/ FLW（主催者フォロー）/ NTF（通知）/ PRF（プロフィール）/ MNG（主催者管理）/ SYS（システム）

## 機能一覧

### 認証（AUTH）

| 機能ID | カテゴリ | 機能名 | 概要 | 利用者（権限） | 画面 | API（メソッド + パス） |
|---|---|---|---|---|---|---|
| F-AUTH-01 | 認証 | アカウント種別選択 | ログイン・新規登録時に「参加者」「主催者」のどちらかを選ぶ | 全員 | `/login`、`/register` | — |
| F-AUTH-02 | 認証 | 参加者ログイン | メールアドレス・パスワードでログイン。participant 以外のアカウントは拒否（即ログアウト）。成功時は `state.from` または `/` へ。ログイン失敗が上限を超えると 429 | 全員 | `/login/participant` | `POST /api/auth/login`、`GET /api/auth/me` |
| F-AUTH-03 | 認証 | 主催者ログイン | 同上。facilitator / admin のみ許可。成功時は `state.from` または `/manage` へ | 全員 | `/login/facilitator` | `POST /api/auth/login`、`GET /api/auth/me` |
| F-AUTH-04 | 認証 | 参加者登録 | 名前・メール・パスワード（8 文字以上）で participant として登録し、自動ログイン | 全員 | `/register/participant` | `POST /api/auth/register`、`POST /api/auth/login`、`GET /api/auth/me` |
| F-AUTH-05 | 認証 | 主催者登録 | facilitator として登録し、自動ログインして `/manage` へ | 全員 | `/register/facilitator` | `POST /api/auth/register`、`POST /api/auth/login`、`GET /api/auth/me` |
| F-AUTH-06 | 認証 | ログイン状態の復元 | 起動時に localStorage の JWT でユーザー情報を取得。API が 401 を返したら `AUTH_EXPIRED_EVENT` を発火してログアウトする | ログイン | （全画面共通） | `GET /api/auth/me` |
| F-AUTH-07 | 認証 | ログアウト | トークンを破棄して `/login` へ遷移（サーバー API 呼び出しなし） | ログイン | `/me` | — |
| F-AUTH-08 | 認証 | 画面アクセス制御 | 未ログイン時はログイン画面へ（`state.from` に元のパス + クエリ）、主催者画面・管理者画面にロール不足でアクセスすると `/` へリダイレクト（`/manage/payout-requests` は admin のみ） | 全員 | ログイン必須画面・`/manage` 配下 | — |
| F-AUTH-09 | 認証 | ロール変更（管理者付与） | 運用スクリプトで既存ユーザーのロールを変更する。admin は API からは作成できない | 管理者（運用者） | なし（`backend/scripts/set_role.py`） | — |

### ワークショップ閲覧（WS）

| 機能ID | カテゴリ | 機能名 | 概要 | 利用者（権限） | 画面 | API（メソッド + パス） |
|---|---|---|---|---|---|---|
| F-WS-01 | ワークショップ | 公開ワークショップ一覧 | 公開中かつ開始前のワークショップをカード表示。ログイン中は、自分が予約済み（確定済み）のワークショップと、自分が主催するワークショップを除く。並び替えは開催日時の近い順（既定）/ 公開日時の新しい順 / 価格の安い順 | 全員 | `/` | `GET /api/workshops?sort=&limit=&offset=&exclude_reserved=true&exclude_own=true` |
| F-WS-02 | ワークショップ | ワークショップ検索・絞り込み | キーワード（タイトル・説明の部分一致、最大 100 文字）、開催形式、料金（無料 / 有料）、上限金額（有料時）、開催日の範囲。「参加可能なワークショップを表示する」は満員と予約締切後（開始 24 時間前以降）を除外 | 全員 | `/` | `GET /api/workshops?q=&location_type=&price=&max_price=&start_from=&start_to=&available=` |
| F-WS-03 | ワークショップ | ワークショップ詳細 | 画像・日時・予約締切・場所・参加費（支払方法の注記付き）・定員・説明を表示。有料なら、日時などの欄の下に本サービス共通の「キャンセルについて」の要約（当日払い: 参加者都合のキャンセルにキャンセル料はかからない / オンライン決済: 返金の扱い）とキャンセルポリシー（`/help/cancellation-policy`）へのリンクを表示（ワークショップごとのキャンセルポリシーはない）。下書きは主催者本人と admin のみ、中止はそれに加えて予約したことのあるユーザーも閲覧可（「中止になりました」と表示）。予約した参加者と主催者には当日の案内・緊急連絡先も表示 | 全員 | `/workshops/:id` | `GET /api/workshops/{workshop_id}` |
| F-WS-04 | ワークショップ | 地図表示リンク | オフライン開催の場所を Google マップ検索で新しいタブに表示 | 全員 | `/workshops/:id` | —（外部リンク） |
| F-WS-05 | ワークショップ | 閲覧者別の状態表示 | ログインユーザーごとのお気に入り登録・予約済み・主催者による取消済み・オンライン決済の支払い待ち（`viewer`）をカード・詳細・予約フォームに反映 | ログイン | `/`、`/workshops/:id`、`/workshops/:id/reserve`、`/favorites`、`/facilitators/:id` | `GET /api/workshops`、`GET /api/workshops/{workshop_id}` |
| F-WS-06 | ワークショップ | 主催者プロフィール閲覧 | 主催者の名前・ロール（主催者 / 運営）・自己紹介と、その主催者の開催予定のワークショップ一覧を表示。フォローボタン（F-FLW-01〜03）を併置 | 全員 | `/facilitators/:id` | `GET /api/facilitators/{user_id}`、`GET /api/workshops?facilitator_id=` |
| F-WS-07 | ワークショップ | 関連するワークショップ | 詳細ページの下に、同じ主催者・類似・近くで開催する開催予定のワークショップを表示 | 全員 | `/workshops/:id` | `GET /api/workshops/{workshop_id}/related` |

### 予約（RSV）

| 機能ID | カテゴリ | 機能名 | 概要 | 利用者（権限） | 画面 | API（メソッド + パス） |
|---|---|---|---|---|---|---|
| F-RSV-01 | 予約 | 予約（参加者情報入力） | 連絡先メールアドレスとチケット枚数（1〜「残席と 4 の小さい方」）を入力し、内容確認のチェック後に予約（有料ならお支払い金額の下に「キャンセルについて」の要約を表示し、確認の文言は「ワークショップの内容とキャンセルについての案内を確認しました」）。参加者名はアカウント名。当日払い・無料はこの時点で確定（オンライン決済は F-PAY-05）。開始 24 時間前以降・自分が主催するもの・予約済み・主催者に取り消されたもの・残席不足は 409。支払われずに期限切れになった予約は同じ行で予約し直す | ログイン | `/workshops/:id/reserve` | `GET /api/workshops/{workshop_id}`、`POST /api/workshops/{workshop_id}/reservations` |
| F-RSV-05 | 予約 | 当日の案内の送付 | 予約が確定したとき（当日払い・無料の予約時、オンライン決済の支払いの反映時）、当日の案内・緊急連絡先があれば、主催者からの一斉送信のメッセージとして参加者とのやり取りに送る（確定と同じトランザクション）。当日の案内・緊急連絡先は公開後は変更できない（送った内容と食い違わないため）。空欄のまま公開した場合や追加の連絡は、「参加者全員へのお知らせ」（一斉送信）で行う | システム（予約の確定を契機） | `/inquiries` に表示 | `POST /api/workshops/{workshop_id}/reservations`、Webhook・完了画面からの確認の内部処理 |
| F-RSV-02 | 予約 | 参加予定のワークショップ | 確定済みとお支払い待ちの予約のうち、中止でなく終了前のものを開始日時の順に表示。お支払い待ちには期限と「お支払いを再開する」、確定済みには「主催者に問い合わせる」を表示。予約直後（当日払い・無料）は完了メッセージを表示。期限切れ（`expired`）の予約は表示しない | ログイン | `/reservations` | `GET /api/reservations/me` |
| F-RSV-03 | 予約 | 予約キャンセル（主催者による取消） | 参加者は自分で取り消せない（画面には「キャンセルをご希望の場合は、ワークショップの主催者にご連絡ください。」と表示）。主催者が予約状況画面で理由（主催者の都合 / 参加者からの申し出）を選んで取り消すと、予約を `canceled` にして理由を記録し、参加者へ `reservation_canceled` 通知。オンライン決済で支払い済みなら理由に応じて返金（F-PAY-10）。確定済み・ワークショップが中止でない・開始前の予約だけが対象（それ以外は 409）。取り消された参加者は同じワークショップを再予約できない | 主催者（所有者 / admin） | `/manage/workshops/:id/reservations` | `POST /api/workshops/{workshop_id}/reservations/{reservation_id}/cancel` |
| F-RSV-04 | 予約 | 予約・参加履歴 | 「参加履歴」（確定済みで終了後）と「予約履歴」（取消・中止を含む全予約を予約日時の新しい順。状態と返金の状況を表示）をタブで切り替える | ログイン | `/reservations/history` | `GET /api/reservations/me` |

### オンライン決済（PAY）

| 機能ID | カテゴリ | 機能名 | 概要 | 利用者（権限） | 画面 | API（メソッド + パス） |
|---|---|---|---|---|---|---|
| F-PAY-01 | オンライン決済 | （廃止）受け取り設定の状態表示 | Stripe Connect の廃止（マイグレーション 0021）に伴い削除。主催者ごとの受け取り設定はなくなり、オンライン決済を選べるかは運営側の設定だけで決まる（F-PAY-04）。売上の確認は F-PAYOUT-01 / 02 | — | — | （廃止）`GET /api/facilitators/me/payout-account` |
| F-PAY-02 | オンライン決済 | （廃止）受け取り設定の開始・継続 | Stripe Connect の廃止に伴い削除（連結アカウントの作成・Stripe の受け取り設定画面への移動はない）。振込先は F-PAYOUT-03 でアプリに登録する | — | — | （廃止）`POST /api/facilitators/me/payout-account/onboarding` |
| F-PAY-03 | オンライン決済 | （廃止）売上・入金の確認（Stripe Express ダッシュボード） | Stripe Connect の廃止に伴い削除。売上・振込の確認は F-PAYOUT-01〜05 | — | — | （廃止）`POST /api/facilitators/me/payout-account/dashboard` |
| F-PAY-04 | オンライン決済 | 支払方法の選択 | 「当日払い」/「オンライン決済(カード)」を選ぶ（無料のときも欄は表示し、選択肢を無効にして案内する）。オンライン決済は運営側でオンライン決済が有効（`online_payment_available`）なときだけ選べ、参加費は 50 円以上。説明文で「参加費の90%が売上になり、開催後に「売上と振込」から振込を申請できます」と案内する。無料なら当日払いに揃える。オンライン決済で新しく公開するときに運営側で無効なら 409「現在、オンライン決済はご利用いただけません」（下書きは保存可）。公開中は支払方法を変更できない | 主催者 | `/manage/workshops/new`、`/manage/workshops/:id/edit` | `GET /api/facilitators/me/payouts/summary`、`POST /api/workshops`、`PUT /api/workshops/{workshop_id}` |
| F-PAY-05 | オンライン決済 | オンライン決済での予約（席の仮押さえ） | オンライン決済のワークショップを予約すると、予約を `pending_payment` にして 32 分間（`PAYMENT_HOLD`）席を確保し、支払い（金額 = 参加費 × 枚数、運営の手数料 = 金額 × `PLATFORM_FEE_PERCENT` %（既定 10%、1 円未満切り捨て）、主催者の受取額 = 金額 − 運営の手数料）を記録する。席の確保を commit してから運営の Stripe アカウント上に Checkout を作成し、`checkout_url` を返す。Stripe が失敗したら席を手放して 503。作成中に中止・取りやめがあれば Checkout を閉じて 409。運営側でオンライン決済が無効になっていれば 409「このワークショップは現在オンライン決済を受け付けていません。主催者にお問い合わせください」 | ログイン | `/workshops/:id/reserve` → Stripe Checkout | `POST /api/workshops/{workshop_id}/reservations` |
| F-PAY-06 | オンライン決済 | 支払いの再開 | 支払い待ちのまま戻ってきた参加者に「お支払いが完了していません」を表示し、「お支払いを再開する」で同じ Checkout へ移動する。Checkout がもう開いていなければ状態を反映して 409。詳細画面・参加予定画面にも「お支払いを再開する」を表示 | ログイン | `/workshops/:id/reserve`、`/workshops/:id`、`/reservations` | `POST /api/workshops/{workshop_id}/reservations` |
| F-PAY-07 | オンライン決済 | 支払いの取りやめ | 「予約をやめる」で Stripe の Checkout を閉じ、予約を `expired` にして席をすぐ手放す。支払い待ちでなければ 409。Checkout を閉じられなかったら Stripe の状態を読み直して反映する | ログイン（予約者本人） | `/workshops/:id/reserve` | `GET /api/reservations/me`、`POST /api/reservations/{reservation_id}/abandon-payment` |
| F-PAY-08 | オンライン決済 | 決済完了の確認 | Stripe Checkout の `success_url` で戻る画面。予約を 2 秒間隔で最大 10 回取り直し、確定・確認中・中止・返金・期限切れを表示する。バックエンドは支払い待ちなら Stripe から Checkout の状態を読み直して反映してから返す | ログイン（予約者本人） | `/reservations/:id/payment/complete` | `GET /api/reservations/{reservation_id}` |
| F-PAY-09 | オンライン決済 | Webhook の反映 | Stripe の署名を検証し、`checkout.session.completed`（支払い完了: 決済手数料を取得して予約を確定）、`checkout.session.expired`（席を手放す）、`charge.refund.updated` / `refund.failed`（返金の失敗）を反映する（運営のアカウントのイベント。`account.updated` は扱わない。対応する支払いのない Checkout のイベントは無視）。処理済みのイベント ID を `stripe_events` に記録して二重に反映しない。反映に失敗したら 5xx（Stripe が再送） | Stripe | なし | `POST /api/stripe/webhook` |
| F-PAY-10 | オンライン決済 | 取消時の返金 | 主催者が支払い済みの予約を取り消すと、返金額を確定して `refund_pending` にし、commit 後に Stripe へ返金を依頼する。主催者都合は全額、参加者都合は Stripe の決済手数料と運営の手数料を差し引いた額（0 円なら Stripe に依頼せず返金済みにする）。どちらの場合も、返金の対象になった支払いは主催者の売上に数えない（主催者の手数料の負担もない）。取消フォームで返金額の見込みを事前に表示する | 主催者（所有者 / admin） | `/manage/workshops/:id/reservations` | `POST /api/workshops/{workshop_id}/reservations/{reservation_id}/cancel` |
| F-PAY-11 | オンライン決済 | 中止時の全額返金 | ワークショップを中止すると、確定済み予約の支払いを全額返金の対象にし、支払い待ちの予約を `expired` にする。commit 後に返金を依頼し、開いている Checkout を閉じる。中止の通知に「オンラインでお支払いいただいた参加費は全額返金します。」を追記 | 主催者（所有者 / admin） | `/manage/workshops/:id/edit` | `POST /api/workshops/{workshop_id}/cancel` |
| F-PAY-12 | オンライン決済 | 参加を確定できない支払いの全額返金 | 支払いが完了しても、ワークショップが公開中でない・別の支払いで予約し直していた・期限切れ後に席が埋まった場合は、予約を確定せず全額返金の対象にする（Webhook・完了画面の確認の両方で同じ判定。ワークショップ → 予約 → 支払いの順に行ロック） | システム | `/reservations/:id/payment/complete` に結果を表示 | `POST /api/stripe/webhook`、`GET /api/reservations/{reservation_id}` の内部処理 |
| F-PAY-13 | オンライン決済 | 返金・支払い待ちの定期処理 | 10 分間隔のジョブで、期限を過ぎた支払い待ちの予約を `expired` にし（条件付き UPDATE）、返金待ちの支払いを Stripe で返金する。再試行の前に Stripe 上の既存の返金を確かめて二重返金を防ぎ、5 回失敗したら `refund_failed`（運営が対応）。MySQL の `GET_LOCK` で複数プロセスの同時実行を防ぐ | システム（APScheduler） | なし | — |
| F-PAY-14 | オンライン決済 | 決済状態の表示 | 主催者向け: 予約ごとに「オンライン決済済み」「返金手続き中(¥n)」「返金済み(¥n)」「返金なし(手数料の差し引きにより0円)」「返金できていません(¥n。運営が対応します)」と取消理由を表示し、お支払い待ちのチケット数を別に添える。手数料の内訳は主催者・運営にだけ返す。参加者向け: 予約履歴に「返金手続き中」「返金済み」を表示 | ログイン / 主催者 | `/manage/workshops/:id/reservations`、`/reservations/history` | `GET /api/workshops/{workshop_id}/reservations`、`GET /api/reservations/me` |

### 売上と振込（PAYOUT）

参加費は運営の Stripe アカウントで受け取り、支払いごとに主催者の受取額（`payments.facilitator_amount`）を記録する。主催者はその合計から振込を申請し、運営が銀行で手動で振り込んで結果を記録する（`backend/app/services/payouts.py:1-6`）。

| 機能ID | カテゴリ | 機能名 | 概要 | 利用者（権限） | 画面 | API（メソッド + パス） |
|---|---|---|---|---|---|---|
| F-PAYOUT-01 | 売上と振込 | 売上の状況 | 振込を申請できる額・開催前の額・振込待ちの額・振込済みの額と、最低額・振込手数料・いま申請できるか・運営側でオンライン決済が使えるかを返す。残高は列に持たず、公開中のワークショップで支払い済みのままの支払いの受取額と、振込の申請から毎回計算する。開催を終えた（終了日時を過ぎた）分だけを申請できる額に入れる | 主催者 | `/manage/payout`（作成・編集画面の支払方法の判定にも使う） | `GET /api/facilitators/me/payouts/summary` |
| F-PAYOUT-02 | 売上と振込 | 売上の明細 | 自分のワークショップで支払われたオンライン決済（返金になったものを含む）を、ワークショップの終了日時の新しい順に 10 件ずつ表示。受取額（返金なら 0）と「確定」/「開催前」/「返金のため受取なし」を表示し、ワークショップ名から予約状況へ移動できる | 主催者 | `/manage/payout` | `GET /api/facilitators/me/payouts/earnings?limit=&offset=` |
| F-PAYOUT-03 | 売上と振込 | 振込先口座の登録・変更 | 金融機関名・金融機関コード（4 桁）・支店名・支店コード（3 桁）・預金種目（普通 / 当座）・口座番号（7 桁）・口座名義（全角カタカナなど）を登録する。1 人 1 口座で、登録し直すと上書き。申請中の振込は申請時の口座へ振り込む。入力の誤りは送信時に画面でも確かめ、最終的な検証は API（422） | 主催者 | `/manage/payout` | `GET /api/facilitators/me/payouts/bank-account`、`PUT /api/facilitators/me/payouts/bank-account` |
| F-PAYOUT-04 | 売上と振込 | 振込の申請 | 確認ダイアログの後、申請できる額の全額で振込を申請する（振込額 = 申請額 − 振込手数料）。振込先は申請時の口座を写して残す。口座が未登録・申請中のものがある・申請できる額が最低額未満なら 409（画面ではボタンを無効にして理由を表示）。同時の申請で残高を二重に使わないよう、ユーザーの行をロックしてから計算する | 主催者 | `/manage/payout` | `POST /api/facilitators/me/payouts/requests` |
| F-PAYOUT-05 | 売上と振込 | 振込の申請の履歴 | 自分の申請を新しい順に 5 件ずつ表示。申請額・振込手数料・振込額・振込先・状態（振込待ち / 振込済み / 取り下げ）・処理日時・運営からのメモを表示 | 主催者 | `/manage/payout` | `GET /api/facilitators/me/payouts/requests?limit=&offset=` |
| F-PAYOUT-06 | 売上と振込 | 振込の申請の一覧（運営） | 全主催者の申請を、状態（振込待ち / 振込済み / 取り下げ / すべて）で絞り込み、申請の古い順に 20 件ずつ表示。主催者名・メールアドレス・振込額・口座の各項目を表示 | 管理者 | `/manage/payout-requests` | `GET /api/admin/payout-requests?status=&limit=&offset=` |
| F-PAYOUT-07 | 売上と振込 | 振込済みにする（運営） | 銀行で振り込んだ後に、メモ（任意。最大 1000 文字。主催者にも表示）を付けて申請を振込済みにする。取り消せない。申請中でなければ 409、存在しなければ 404。二重に処理しないよう申請の行をロックする | 管理者 | `/manage/payout-requests` | `POST /api/admin/payout-requests/{request_id}/paid` |
| F-PAYOUT-08 | 売上と振込 | 申請の取り下げ（運営） | 口座の誤りなどで振り込まない申請を、メモを付けて取り下げる。申請額は主催者の申請できる額に戻る。取り消せない。409 / 404 は F-PAYOUT-07 と同じ | 管理者 | `/manage/payout-requests` | `POST /api/admin/payout-requests/{request_id}/reject` |
| F-PAYOUT-09 | 売上と振込 | マイページからの導線 | 「主催者メニュー」に「売上と振込」（facilitator / admin）と「振込の申請(運営)」（admin のみ）を表示 | 主催者 / 管理者 | `/me` | — |

### お気に入り（FAV）

| 機能ID | カテゴリ | 機能名 | 概要 | 利用者（権限） | 画面 | API（メソッド + パス） |
|---|---|---|---|---|---|---|
| F-FAV-01 | お気に入り | お気に入り登録 | ♡ ボタンでお気に入りに追加。未ログイン時は参加者ログインへ誘導。詳細画面では公開中のみボタンを表示 | ログイン | `/`、`/workshops/:id`、`/favorites`、`/facilitators/:id` | `POST /api/workshops/{workshop_id}/favorite` |
| F-FAV-02 | お気に入り | お気に入り解除 | ♡ ボタンで解除 | ログイン | 同上 | `DELETE /api/workshops/{workshop_id}/favorite` |
| F-FAV-03 | お気に入り | お気に入り一覧 | 自分のお気に入りを登録日時の新しい順に表示 | ログイン | `/favorites` | `GET /api/favorites` |

### 主催者フォロー（FLW）

| 機能ID | カテゴリ | 機能名 | 概要 | 利用者（権限） | 画面 | API（メソッド + パス） |
|---|---|---|---|---|---|---|
| F-FLW-01 | 主催者フォロー | 主催者をフォロー | 「フォローする」ボタンで主催者をフォロー。対象は role が facilitator のユーザーだけ（admin・存在しないユーザーは 404、自分自身は 409）。フォロー済みならそのまま成功扱い。未ログイン時はボタンの代わりに「ログインしてフォロー」を表示し、参加者ログインへ誘導（`state.from` 付き）。失敗時はボタン下にエラーを 4 秒表示 | ログイン（ロール不問） | `/facilitators/:id`、`/following` | `POST /api/facilitators/{facilitator_id}/follow` |
| F-FLW-02 | 主催者フォロー | フォロー解除 | 「フォロー中」ボタンを押して解除。フォローしていなくてもエラーにしない | ログイン | `/facilitators/:id`、`/following` | `DELETE /api/facilitators/{facilitator_id}/follow` |
| F-FLW-03 | 主催者フォロー | フォロー状態の表示 | 主催者プロフィールの取得時に、ログイン中かつ相手が facilitator なら `viewer.is_following` を返し、ボタンの表示（「フォローする」/「フォロー中」）に反映。未ログイン・admin のページでは `viewer` は null。自分自身のページではボタンを表示しない | 全員 | `/facilitators/:id` | `GET /api/facilitators/{user_id}` |
| F-FLW-04 | 主催者フォロー | フォロー中の主催者一覧 | フォローしている主催者（現在も facilitator のもの）をフォローした日時の新しい順に 20 件ずつ表示。主催者名から主催者プロフィールへ。各行に「フォロー中」ボタン（解除すると両一覧を再取得） | ログイン | `/following` | `GET /api/follows/facilitators?limit=&offset=` |
| F-FLW-05 | 主催者フォロー | フォロー中の主催者の開催予定ワークショップ | フォロー中の主催者の、公開中かつ開始前のワークショップを開始日時の早い順に 10 件ずつカード表示 | ログイン | `/following` | `GET /api/follows/workshops?limit=&offset=` |
| F-FLW-06 | 主催者フォロー | マイページからの導線 | マイページの「予約・お気に入り」に「フォロー中の主催者のワークショップ」メニューを表示 | ログイン | `/me` | — |

### 通知（NTF）

| 機能ID | カテゴリ | 機能名 | 概要 | 利用者（権限） | 画面 | API（メソッド + パス） |
|---|---|---|---|---|---|---|
| F-NTF-01 | 通知 | 通知一覧 | 自分宛ての通知を新しい順に表示。種別バッジは「中止」「リマインダー」「参加キャンセル」「新着」「返金」（返金完了・返金失敗の両方）。クリックでワークショップ詳細へ | ログイン | `/notifications` | `GET /api/notifications` |
| F-NTF-02 | 通知 | 未読件数バッジ | Navbar の通知アイコンに未読件数を表示（ポーリングで更新） | ログイン | Navbar | `GET /api/notifications/unread-count` |
| F-NTF-03 | 通知 | 通知の既読化 | 通知カードのクリックで 1 件を既読化 | ログイン（宛先本人） | `/notifications` | `POST /api/notifications/{notification_id}/read` |
| F-NTF-04 | 通知 | すべて既読 | 未読の通知をまとめて既読化 | ログイン | `/notifications` | `POST /api/notifications/read-all` |
| F-NTF-05 | 通知 | 中止通知の自動作成 | ワークショップが `canceled` に変更されたとき、予約確定済みの参加者へ `cancellation` 通知を作成。オンライン決済で返金がある場合は「オンラインでお支払いいただいた参加費は全額返金します。」を追記。同じワークショップの `new_workshop` 通知は削除する | システム（主催者の中止操作を契機） | なし | `POST /api/workshops/{workshop_id}/cancel` の内部処理 |
| F-NTF-06 | 通知 | 開催前日リマインド | 30 分間隔のジョブで、公開中かつ開始が 25 時間以内（開始前）のワークショップの予約確定者へ `reminder` 通知を作成（同一通知は 1 人 1 回）。当日の案内・緊急連絡先は、ここでは送らない（予約の確定時に送る。F-RSV-05）。MySQL の `GET_LOCK` で複数プロセスの同時実行を防ぐ | システム（APScheduler） | なし | — |
| F-NTF-07 | 通知 | 新着ワークショップ通知 | ワークショップが初めて公開されたとき（公開状態での作成、または下書きからの公開）、持ち主の role が facilitator なら、その主催者のフォロワーへ `new_workshop` 通知を公開と同じトランザクションで作成（運営が主催者の下書きを公開した場合も通知する。持ち主が admin のものは通知しない）。通知一覧では「新着」と表示 | システム（公開操作を契機） | `/notifications` に表示 | `POST /api/workshops`、`PUT /api/workshops/{workshop_id}` の内部処理 |
| F-NTF-08 | 通知 | 参加キャンセル通知 | 主催者が予約を取り消したとき、参加者へ `reservation_canceled` 通知を取消と同じトランザクションで作成。オンライン決済で支払い済みなら、取消の理由と返金額（参加者都合で 0 円ならその旨）を本文に含める | システム（主催者の取消操作を契機） | `/notifications` に表示 | `POST /api/workshops/{workshop_id}/reservations/{reservation_id}/cancel` の内部処理 |
| F-NTF-09 | 通知 | 返金完了通知 | オンライン決済の参加費の返金が完了したとき（返金額 1 円以上）、参加者へ `payment_refunded` 通知（「「{タイトル}」の参加費{n}円を返金しました。…」）を返金の記録と同じトランザクションで作成。同じワークショップで 2 回目の返金では追加しない | システム（返金処理を契機） | `/notifications` に表示 | 取消・中止の API と定期処理の内部処理 |
| F-NTF-10 | 通知 | 返金失敗通知 | 返金済みと知らせた後に Stripe 側で返金が失敗した（Webhook）とき、参加者へ `payment_refund_failed` 通知（「…カード会社の都合で完了できませんでした。運営で確認し、あらためてご連絡します。」）を作成し、支払いを `refund_failed` にする | システム（Webhook を契機） | `/notifications` に表示 | `POST /api/stripe/webhook` の内部処理 |

### プロフィール・設定（PRF）

| 機能ID | カテゴリ | 機能名 | 概要 | 利用者（権限） | 画面 | API（メソッド + パス） |
|---|---|---|---|---|---|---|
| F-PRF-01 | プロフィール | マイページ（旧 設定メニュー） | 「予約・お気に入り」（参加予定・予約・参加履歴・お気に入り・フォロー中の主催者のワークショップ）、「主催者メニュー」（主催者のみ。ワークショップの管理・売上と振込、admin には振込の申請(運営)も）、「問い合わせ」、「アカウント」（プロフィール編集）、「ヘルプ・規約」のメニューとログアウトを表示。旧 `/settings` は `/me` へリダイレクト | ログイン | `/me` | — |
| F-PRF-02 | プロフィール | プロフィール編集 | 表示名（必須、最大 255 文字）と自己紹介（最大 2000 文字）を更新 | ログイン | `/me/profile` | `PATCH /api/auth/me`、`GET /api/auth/me` |

### 主催者管理（MNG）

| 機能ID | カテゴリ | 機能名 | 概要 | 利用者（権限） | 画面 | API（メソッド + パス） |
|---|---|---|---|---|---|---|
| F-MNG-01 | 主催者管理 | 自分のワークショップ一覧 | 自分のワークショップ（admin は全件）を「開催予定」/「下書き」/「開催履歴」タブで表示。開催予定・開催履歴では中止したものを見出しを分けて表示。定員・参加者数を表示 | 主催者 | `/manage` | `GET /api/manage/workshops` |
| F-MNG-02 | 主催者管理 | ワークショップ作成 | タイトル・説明・画像・開催形式・場所・日時・定員・参加費・支払方法（F-PAY-04）・当日の案内・緊急連絡先を入力し、下書き保存または公開 | 主催者 | `/manage/workshops/new` | `POST /api/workshops` |
| F-MNG-03 | 主催者管理 | ワークショップ編集 | 既存ワークショップを編集し、下書き保存（下書きのみ）または公開。開催済み・中止のものは編集不可（API も 409）。公開中は参加費・支払方法・日時・開催形式・場所・当日の案内・緊急連絡先を変更できず、下書きにも戻せない。定員は確保済みのチケット枚数を下回れない | 主催者（所有者 / admin） | `/manage/workshops/:id/edit` | `GET /api/workshops/{workshop_id}`、`PUT /api/workshops/{workshop_id}` |
| F-MNG-04 | 主催者管理 | ワークショップ画像の登録・削除 | jpg / png / webp / gif（5MB 以内）の画像をアップロード、または削除。旧画像ファイルは削除。開催済み・中止のものは API が 409 を返す | 主催者（所有者 / admin） | `/manage/workshops/new`、`/manage/workshops/:id/edit` | `POST /api/workshops/{workshop_id}/image`、`DELETE /api/workshops/{workshop_id}/image` |
| F-MNG-05 | 主催者管理 | ワークショップ中止 | 公開中のワークショップのみ。確認（オンライン決済なら全額返金の旨を追記）後、ステータスを `canceled` に更新し、F-NTF-05 の通知と F-PAY-11 の返金を行う。操作は編集画面の下部の「ワークショップの中止」から行う（編集中の内容は保存しない）。下書き・中止済み・開催済みは 409 | 主催者（所有者 / admin） | `/manage/workshops/:id/edit` | `POST /api/workshops/{workshop_id}/cancel` |
| F-MNG-06 | 主催者管理 | ワークショップ削除 | 下書きのみ削除できる（確認後に物理削除。関連するお気に入り・通知・問い合わせも ORM カスケードで削除）。公開中・中止のものは記録として残すため削除ボタンを出さず、API も 409 を返す | 主催者（所有者 / admin） | `/manage` | `DELETE /api/workshops/{workshop_id}` |
| F-MNG-07 | 主催者管理 | 予約状況の確認 | ワークショップの予約者一覧（名前・メール・枚数・状態・予約日時・決済状態・取消理由）と参加人数（確定チケット数）・お支払い待ちの人数を表示。支払われずに期限が過ぎた予約は表示しない。各行から参加の取消（F-RSV-03）を行う | 主催者（所有者 / admin） | `/manage/workshops/:id/reservations` | `GET /api/workshops/{workshop_id}`、`GET /api/workshops/{workshop_id}/reservations` |
| F-MNG-08 | 主催者管理 | 入力内容の自動保存 | 作成・編集フォームの入力内容を入力が止まって 1 秒後にブラウザの localStorage へ自動保存し、次に開いたときに復元・破棄を選べる。画像は対象外。保存成功・キャンセルで削除 | 主催者 | `/manage/workshops/new`、`/manage/workshops/:id/edit` | —（ブラウザ内のみ） |
| F-MNG-09 | 主催者管理 | 出欠の記録 | 公開中のワークショップで開始 24 時間前以降、確定済みの予約ごとに出欠（未確認 / 出席 / 欠席）を記録し、出席・欠席・未確認の人数を表示する。開催後も修正可 | 主催者（所有者 / admin） | `/manage/workshops/:id/reservations` | `PUT /api/workshops/{workshop_id}/reservations/{reservation_id}/attendance` |

### システム（SYS）

| 機能ID | カテゴリ | 機能名 | 概要 | 利用者（権限） | 画面 | API（メソッド + パス） |
|---|---|---|---|---|---|---|
| F-SYS-01 | システム | ヘルスチェック | `{"status": "ok"}` を返す | 全員 | なし | `GET /api/health` |
| F-SYS-02 | システム | アップロード画像の配信 | 保存済みの画像を静的ファイルとして配信（`X-Content-Type-Options: nosniff` 付き） | 全員 | カード・詳細・管理画面の画像表示 | `GET /api/uploads/{path}` |
| F-SYS-03 | システム | 404 ページ | 未定義パスを `/404` にリダイレクトして表示 | 全員 | `/404` | — |
| F-SYS-04 | システム | サンプルデータ投入 | 動作確認用のユーザー・ワークショップ・予約を投入する運用スクリプト（内容は未確認） | 運用者 | なし（`backend/scripts/seed_sample_data.py`） | — |
| F-SYS-05 | システム | 起動時の設定確認 | JWT 秘密鍵の強さ（`check_jwt_secret()`）と Stripe・手数料・振込の設定（`check_stripe_settings()`。`PLATFORM_FEE_PERCENT` の範囲、`PAYOUT_TRANSFER_FEE` < `PAYOUT_MIN_AMOUNT` など）を確かめ、危険な設定なら起動を止める・警告する | システム | なし | — |

## API 一覧

認証要否: 「不要」= トークンなしで可、「任意」= トークンがあれば閲覧者情報を反映、「必須」= ログイン必須、「主催者」= facilitator / admin 必須（`require_roles`）、「管理者」= admin 必須（`require_roles(UserRole.admin)`）、「署名」= Stripe の Webhook 署名で検証。

| No | メソッド | パス | 認証要否 | 概要 | ルーターファイル |
|---|---|---|---|---|---|
| 1 | POST | `/api/auth/register` | 不要 | ユーザー登録（role は facilitator / participant のみ）。メール重複は 409 | `backend/app/routers/auth.py` |
| 2 | POST | `/api/auth/login` | 不要 | ログイン（form: username, password）。JWT を返す。失敗は 401、失敗回数の上限超過は 429 | `backend/app/routers/auth.py` |
| 3 | GET | `/api/auth/me` | 必須 | ログインユーザー情報の取得 | `backend/app/routers/auth.py` |
| 4 | PATCH | `/api/auth/me` | 必須 | 表示名・自己紹介の更新 | `backend/app/routers/auth.py` |
| 5 | GET | `/api/workshops` | 任意 | 公開中かつ開始前のワークショップの検索・一覧。クエリ: `facilitator_id`, `q`, `location_type`, `price`, `max_price`, `available`, `exclude_reserved`, `exclude_own`, `start_from`, `start_to`, `sort`, `limit`, `offset`（`limit` 指定時は総件数を `X-Total-Count` ヘッダーで返す）。存在しないパラメータや `start_from >= start_to` は 422 | `backend/app/routers/workshops.py` |
| 5-2 | GET | `/api/manage/workshops` | 主催者 | 管理用のワークショップ一覧。下書き・中止を含む自分のワークショップ（admin は全員分） | `backend/app/routers/manage.py` |
| 6 | GET | `/api/workshops/{workshop_id}` | 任意 | ワークショップ詳細。非公開は所有者 / admin 以外 404。ただし中止済みは、そのワークショップを予約したことのあるユーザーも閲覧可。`payment_method`、`viewer`（`is_payment_pending` を含む）、`participant_info`（予約者・主催者のみ）を返す | `backend/app/routers/workshops.py` |
| 6-2 | GET | `/api/workshops/{workshop_id}/related` | 任意 | 関連するワークショップ（同じ主催者 / 類似 / 近く） | `backend/app/routers/workshops.py` |
| 7 | POST | `/api/workshops` | 主催者 | ワークショップ作成。`payment_method = online` で公開するときに運営側でオンライン決済が無効なら 409 | `backend/app/routers/workshops.py` |
| 8 | PUT | `/api/workshops/{workshop_id}` | 主催者（所有者 / admin） | ワークショップ更新。`canceled` への変更、公開中の条件（参加費・支払方法・日時・開催形式・場所・当日の案内・緊急連絡先）の変更、公開済みから下書きへの変更は 409 | `backend/app/routers/workshops.py` |
| 8-2 | POST | `/api/workshops/{workshop_id}/cancel` | 主催者（所有者 / admin） | 公開中のワークショップを中止にし、予約確定済みの参加者へ中止通知を作成。オンライン決済の支払いは全額返金し、開いている Checkout を閉じる。下書き・中止済み・開催済みは 409 | `backend/app/routers/workshops.py` |
| 9 | DELETE | `/api/workshops/{workshop_id}` | 主催者（所有者 / admin） | ワークショップ削除（204）。下書きのみ。公開中・中止は 409 | `backend/app/routers/workshops.py` |
| 10 | POST | `/api/workshops/{workshop_id}/image` | 主催者（所有者 / admin） | 画像アップロード（multipart, `file`） | `backend/app/routers/workshops.py` |
| 11 | DELETE | `/api/workshops/{workshop_id}/image` | 主催者（所有者 / admin） | 画像削除 | `backend/app/routers/workshops.py` |
| 12 | POST | `/api/workshops/{workshop_id}/reservations` | 必須 | 予約作成（201）。本文: `contact`（メールアドレス）, `ticket_count`（1〜4）。応答: `{ reservation, checkout_url }`。当日払い・無料は確定して `checkout_url = null`、オンライン決済は支払い待ちで席を確保して Stripe Checkout の URL を返す（支払い待ちのまま再度呼ぶと同じ URL）。締切後・自分の主催・予約済み・取消済み・残席不足は 409、Stripe の失敗は 503 | `backend/app/routers/workshops.py` |
| 13 | GET | `/api/workshops/{workshop_id}/reservations` | 主催者（所有者 / admin） | ワークショップの予約一覧（作成日時昇順。`expired` は除く）。`payment`（手数料の内訳を含む）と `cancel_reason` を返す | `backend/app/routers/workshops.py` |
| 13-2 | POST | `/api/workshops/{workshop_id}/reservations/{reservation_id}/cancel` | 主催者（所有者 / admin） | 参加の取消。本文: `reason`（`participant` / `facilitator`）。参加者へ通知し、支払い済みなら理由に応じて返金。確定済み以外・中止済み・開始済みは 409、別のワークショップの予約 ID は 404 | `backend/app/routers/workshops.py` |
| 13-3 | PUT | `/api/workshops/{workshop_id}/reservations/{reservation_id}/attendance` | 主催者（所有者 / admin） | 出欠の記録。本文: `attendance`（`unconfirmed` / `present` / `absent`）。公開中以外・確定済み以外・開始 24 時間前より前は 409 | `backend/app/routers/workshops.py` |
| 14 | POST | `/api/workshops/{workshop_id}/favorite` | 必須 | お気に入り登録（201。登録済みでもエラーにしない） | `backend/app/routers/favorites.py` |
| 15 | DELETE | `/api/workshops/{workshop_id}/favorite` | 必須 | お気に入り解除（204。未登録でもエラーにしない） | `backend/app/routers/favorites.py` |
| 16 | GET | `/api/reservations/me` | 必須 | 自分の予約一覧（作成日時降順。`expired` は除く） | `backend/app/routers/reservations.py` |
| 17 | — | （廃止）`DELETE /api/reservations/{reservation_id}` | — | 参加者本人による予約キャンセルは廃止された。取消は主催者が No.13-2 で行う | — |
| 18 | GET | `/api/favorites` | 必須 | 自分のお気に入り一覧（登録日時降順） | `backend/app/routers/favorites.py` |
| 19 | GET | `/api/facilitators/{user_id}` | 任意 | 主催者プロフィール（facilitator / admin 以外は 404）。ログイン中かつ相手が facilitator のときは `viewer.is_following` を返す | `backend/app/routers/facilitators.py` |
| 20 | GET | `/api/notifications` | 必須 | 自分の通知一覧（作成日時降順） | `backend/app/routers/notifications.py` |
| 21 | GET | `/api/notifications/unread-count` | 必須 | 未読件数 `{count}` | `backend/app/routers/notifications.py` |
| 22 | POST | `/api/notifications/{notification_id}/read` | 必須（宛先本人） | 通知を既読化 | `backend/app/routers/notifications.py` |
| 23 | POST | `/api/notifications/read-all` | 必須 | 未読通知をすべて既読化（204） | `backend/app/routers/notifications.py` |
| 24 | GET | `/api/health` | 不要 | ヘルスチェック | `backend/app/main.py` |
| 25 | GET | `/api/uploads/{path}` | 不要 | アップロード画像の静的配信（`StaticFiles`） | `backend/app/main.py` |
| 26 | POST | `/api/facilitators/{facilitator_id}/follow` | 必須 | 主催者をフォロー（201、`{"is_following": true}`）。フォロー済みでもエラーにしない。相手が facilitator でなければ 404、自分自身は 409 | `backend/app/routers/follows.py` |
| 27 | DELETE | `/api/facilitators/{facilitator_id}/follow` | 必須 | フォロー解除（204。フォローしていなくてもエラーにしない） | `backend/app/routers/follows.py` |
| 28 | GET | `/api/follows/facilitators` | 必須 | フォロー中の主催者一覧（現在 facilitator のもののみ、フォロー日時の新しい順）。`limit` 指定時は総件数を `X-Total-Count` で返す | `backend/app/routers/follows.py` |
| 29 | GET | `/api/follows/workshops` | 必須 | フォロー中の主催者の開催予定ワークショップ（公開一覧と同じ条件: 公開中・開始前） | `backend/app/routers/follows.py` |
| 30 | GET | `/api/reservations/{reservation_id}` | 必須（予約者本人） | 自分の予約 1 件。支払い待ちなら Stripe から Checkout の状態を読み直して反映してから返す（決済完了画面の確認用）。他人の予約は 404 | `backend/app/routers/reservations.py` |
| 31 | POST | `/api/reservations/{reservation_id}/abandon-payment` | 必須（予約者本人） | オンライン決済の支払いの取りやめ。Checkout を閉じて予約を `expired` にする。支払い待ちでない・支払い画面の準備中・閉じられずまだ支払い待ちは 409 | `backend/app/routers/reservations.py` |
| 32 | — | （廃止）`GET /api/facilitators/me/payout-account` | — | 受け取り設定の状態。Stripe Connect の廃止に伴い削除。代わりは No.36 | — |
| 33 | — | （廃止）`POST /api/facilitators/me/payout-account/onboarding` | — | 受け取り設定の Stripe 画面の URL。Stripe Connect の廃止に伴い削除 | — |
| 34 | — | （廃止）`POST /api/facilitators/me/payout-account/dashboard` | — | Stripe Express ダッシュボードの URL。Stripe Connect の廃止に伴い削除 | — |
| 35 | POST | `/api/stripe/webhook` | 署名 | Stripe の Webhook（運営のアカウントのイベント）。署名を確かめられなければ 400、反映に Stripe の呼び出しが必要で失敗したら 503（Stripe が再送）。成功は 204 | `backend/app/routers/stripe_webhook.py` |
| 36 | GET | `/api/facilitators/me/payouts/summary` | 主催者 | 売上の状況 `{ available_amount, upcoming_amount, requested_amount, paid_amount, min_amount, transfer_fee, can_request, online_payment_available }` | `backend/app/routers/payouts.py` |
| 37 | GET | `/api/facilitators/me/payouts/earnings` | 主催者 | 売上の明細（支払い済みになったことのあるオンライン決済。終了日時の新しい順）。`limit` / `offset`（`limit` 指定時は `X-Total-Count`） | `backend/app/routers/payouts.py` |
| 38 | GET | `/api/facilitators/me/payouts/bank-account` | 主催者 | 登録している振込先口座。未登録なら `null` | `backend/app/routers/payouts.py` |
| 39 | PUT | `/api/facilitators/me/payouts/bank-account` | 主催者 | 振込先口座の登録・変更。本文: `bank_name`, `bank_code`, `branch_name`, `branch_code`, `account_type`, `account_number`, `account_holder`。形式の誤りは 422 | `backend/app/routers/payouts.py` |
| 40 | GET | `/api/facilitators/me/payouts/requests` | 主催者 | 自分の振込の申請の履歴（新しい順）。`limit` / `offset` | `backend/app/routers/payouts.py` |
| 41 | POST | `/api/facilitators/me/payouts/requests` | 主催者 | 申請できる額の全額で振込を申請（201、本文なし）。口座が未登録・申請中あり・最低額未満は 409 | `backend/app/routers/payouts.py` |
| 42 | GET | `/api/admin/payout-requests` | 管理者 | 振込の申請の一覧（申請の古い順。主催者の名前・メールを含む）。クエリ: `status`（`requested` / `paid` / `rejected`、省略で全件）, `limit`, `offset` | `backend/app/routers/admin_payouts.py` |
| 43 | POST | `/api/admin/payout-requests/{request_id}/paid` | 管理者 | 申請を振込済みにする。本文: `note`（任意、最大 1000 文字）。申請中でなければ 409、存在しなければ 404 | `backend/app/routers/admin_payouts.py` |
| 44 | POST | `/api/admin/payout-requests/{request_id}/reject` | 管理者 | 申請を取り下げる（申請額は申請できる額に戻る）。本文・エラーは No.43 と同じ | `backend/app/routers/admin_payouts.py` |

- 問い合わせ（`/api/inquiries`、`/api/inquiries/unread-count`、`/api/inquiries/{id}`、`/api/inquiries/{id}/read`、`/api/inquiries/{id}/messages`、`/api/workshops/{id}/inquiry`、`/api/workshops/{id}/inquiry/messages`、`/api/workshops/{id}/inquiry/broadcast`。`backend/app/routers/inquiries.py`）とアイコン（`POST` / `DELETE /api/auth/me/avatar`。`backend/app/routers/auth.py`）は本表では詳細を記載していない。

### フロントエンド API クライアントとの対応

| フロントエンド関数 | API | ファイル |
|---|---|---|
| `login` / `register` / `fetchCurrentUser` | No.2 / No.1 / No.3 | `frontend/src/api/auth.ts` |
| `updateMe` / `getFacilitatorProfile` | No.4 / No.19 | `frontend/src/api/users.ts` |
| `listWorkshops` / `listWorkshopsPage` / `getWorkshop` / `createWorkshop` / `updateWorkshop` / `deleteWorkshop` | No.5 / 5 / 6 / 7 / 8 / 9 | `frontend/src/api/workshops.ts` |
| `listManagedWorkshops` / `getRelatedWorkshops` / `cancelWorkshop` | No.5-2 / 6-2 / 8-2 | `frontend/src/api/workshops.ts` |
| `uploadWorkshopImage` / `deleteWorkshopImage` | No.10 / 11 | `frontend/src/api/workshops.ts` |
| `listMyFavorites` / `addFavorite` / `removeFavorite` | No.18 / 14 / 15 | `frontend/src/api/favorites.ts` |
| `listMyReservations` / `listWorkshopReservations` / `reserveWorkshop` / `getMyReservation` / `abandonPayment` / `cancelWorkshopReservation` / `updateReservationAttendance` | No.16 / 13 / 12 / 30 / 31 / 13-2 / 13-3 | `frontend/src/api/reservations.ts` |
| `getPayoutSummary` / `getEarnings` / `getBankAccount` / `saveBankAccount` / `getPayoutRequests` / `requestPayout` | No.36 / 37 / 38 / 39 / 40 / 41 | `frontend/src/api/payouts.ts` |
| `getAdminPayoutRequests` / `markPayoutPaid` / `rejectPayout` | No.42 / 43 / 44 | `frontend/src/api/payouts.ts` |
| `listNotifications` / `getUnreadNotificationCount` / `markNotificationRead` / `markAllNotificationsRead` | No.20 / 21 / 22 / 23 | `frontend/src/api/notifications.ts` |
| `followFacilitator` / `unfollowFacilitator` / `listFollowedFacilitators` / `listFollowedWorkshops` | No.26 / 27 / 28 / 29 | `frontend/src/api/follows.ts` |

- `reserveWorkshop` は、受け取った `checkout_url` が Stripe のページ（`https` かつ `checkout.stripe.com`）でなければエラーにする（`frontend/src/api/reservations.ts:23`、`frontend/src/utils/payment.ts:32-45`）。
- 一覧系（No.37 / 40 / 42）は `fetchPage()` で `limit` / `offset` を付けて呼び、総件数を `X-Total-Count` から読む（`frontend/src/api/client.ts:67-79`）。
- No.24（health）と No.35（Stripe Webhook）はフロントエンドから呼ばれていない。

---

参照したファイル:
- `backend/app/main.py`
- `backend/app/config.py`
- `backend/app/routers/auth.py`
- `backend/app/routers/workshops.py`
- `backend/app/routers/reservations.py`
- `backend/app/routers/favorites.py`
- `backend/app/routers/facilitators.py`
- `backend/app/routers/notifications.py`
- `backend/app/routers/follows.py`
- `backend/app/routers/manage.py`
- `backend/app/routers/inquiries.py`
- `backend/app/routers/payouts.py`
- `backend/app/routers/admin_payouts.py`
- `backend/app/routers/stripe_webhook.py`
- `backend/app/services/workshops.py`
- `backend/app/services/reservations.py`
- `backend/app/services/payments.py`
- `backend/app/services/payouts.py`
- `backend/app/services/stripe_webhooks.py`
- `backend/app/services/notifications.py`
- `backend/app/services/job_lock.py`
- `backend/app/core/stripe_client.py`
- `backend/app/schemas/workshop.py`
- `backend/app/schemas/reservation.py`
- `backend/app/schemas/payment.py`
- `backend/app/schemas/pagination.py`
- `backend/app/core/errors.py`
- `backend/app/models/*.py`
- `frontend/src/App.tsx`
- `frontend/src/api/reservations.ts`
- `frontend/src/api/payouts.ts`
- `frontend/src/api/client.ts`
- `frontend/src/utils/payment.ts`
- `frontend/src/utils/workshop.ts`
- `frontend/src/pages/workshops/WorkshopDetailPage.tsx`
- `frontend/src/pages/reservations/ReservationFormPage.tsx`
- `frontend/src/pages/reservations/MyReservationsPage.tsx`
- `frontend/src/pages/reservations/PaymentCompletePage.tsx`
- `frontend/src/pages/manage/ManageWorkshopsPage.tsx`
- `frontend/src/pages/manage/WorkshopFormPage.tsx`
- `frontend/src/pages/manage/WorkshopFormFields.tsx`
- `frontend/src/pages/manage/WorkshopReservationsPage.tsx`
- `frontend/src/pages/manage/CancelReservationForm.tsx`
- `frontend/src/pages/manage/PayoutSettingsPage.tsx`
- `frontend/src/pages/manage/BankAccountForm.tsx`
- `frontend/src/pages/manage/AdminPayoutRequestsPage.tsx`
- `frontend/src/utils/payout.ts`
- `frontend/src/pages/me/MyPage.tsx`
- `frontend/src/pages/me/NotificationsPage.tsx`
- `frontend/src/components/layout/ProtectedRoute.tsx`
- `frontend/src/components/layout/Navbar.tsx`
- `frontend/src/components/workshop/CancellationPolicy.tsx`
- `frontend/src/pages/help/CancellationPolicyPage.tsx`
