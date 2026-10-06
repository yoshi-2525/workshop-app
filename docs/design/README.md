# 設計書 目次

最終更新日: 2026-10-06

TAIWA（対話型ワークショップの予約・管理システム）の設計書一覧。すべて現状のコード（作業ツリー）を正として作成しており、図は Mermaid で記述している。

## 設計書一覧

| 設計書 | 内容 | 主な情報源 |
|---|---|---|
| [サイトマップ](./sitemap.md) | 画面の階層、URL、アクセス権限、画面一覧表 | `frontend/src/App.tsx`、`components/layout/ProtectedRoute.tsx`、`components/layout/Navbar.tsx` |
| [画面遷移図](./screen-transition.md) | 共通ナビ・認証・利用者向け・オンライン決済・主催者向け・売上と振込（主催者・運営）の画面遷移とリダイレクト | `pages/**/*.tsx` の `Link` / `navigate()` / `window.location.assign()` |
| [ワイヤーフレーム](./wireframes.md) | 共通レイアウトと各画面の ASCII レイアウト、状態別の表示 | `pages/**/*.tsx`、`components/**/*.tsx` |
| [ER 図](./er-diagram.md) | テーブルの ER 図、予約・支払い・振込の申請の状態遷移、売上と振込の残高の定義、テーブル定義、日時・隔離レベル、マイグレーション履歴、定義間の整合性 | `backend/app/models/`、`alembic/versions/`、`schema.sql` |
| [システム構成図](./system-architecture.md) | ブラウザ〜Vite〜FastAPI〜MySQL〜Stripe の構成、認証方式、Stripe 連携、主催者への振込、定期処理、技術スタック、環境変数 | `vite.config.ts`、`app/main.py`、`app/config.py`、`app/database.py`、`core/stripe_client.py`、`requirements.txt`、`package.json` |
| [機能一覧表](./feature-list.md) | カテゴリ別の機能一覧（機能 ID 付き）と API 一覧 | `app/routers/`、`app/services/`、`src/api/`、`src/pages/` |

## 表記ルール

- 推測で補った記述には「※推測」と明記している。
- 各設計書の末尾に、根拠として参照したファイルを列挙している。
- 機能 ID は `F-<カテゴリ略称>-<連番>` 形式。更新時も既存の ID は変更しない。

## 更新履歴

| 日付 | 内容 |
|---|---|
| 2026-09-25 | 初版作成（6 種類の設計書と本目次） |
| 2026-09-25 | コード変更に追従（日時の UTC 扱い、マイグレーション 0009、中止ワークショップの閲覧権限、削除制限、予約枚数上限、ログイン切替時の state 引き継ぎ、`.env.example` の追記など） |
| 2026-10-05 | 主催者フォロー機能を反映（`facilitator_follows` テーブル、通知種別 `new_workshop`、フォロー API、`/following` 画面、主催者プロフィールのフォローボタン、マイページ `/me` からの導線、通知一覧の「新着」）。対象: サイトマップ・画面遷移図・ワイヤーフレーム・ER 図・システム構成図・機能一覧表。なお、マイグレーション 0012〜0016 相当の変更（問い合わせ、ヘルプ・ガイド、予約履歴、アバター、参加キャンセル通知、Navbar の刷新、ファイル配置の移動など）は未反映で、各設計書の冒頭に注記している |
| 2026-10-05 | Stripe Connect による参加費のオンライン決済を反映（マイグレーション 0018・0019: `users.stripe_account_id` / `stripe_charges_enabled`、`workshops.payment_method`、`reservations` の `pending_payment` / `expired`・`payment_expires_at`・`cancel_reason`、`payments` / `stripe_events` テーブル、通知種別 `payment_refunded` / `payment_refund_failed`。画面 `/manage/payout`・`/reservations/:id/payment/complete`、予約フォームの支払い・再開・取りやめ、支払方法の選択、予約者一覧の取消フォーム。機能カテゴリ PAY、Webhook、返金、決済の定期処理、Stripe 連携・READ COMMITTED）。あわせて ER 図に 0012〜0016（アバター、問い合わせ、当日の案内、出欠など）を反映し、サイトマップの全ルート・ファイル配置、Navbar、予約のキャンセル主体（参加者 → 主催者）、チケット上限（4 枚）、削除できるのは下書きのみ、リマインダーの条件、JWT ライブラリ（PyJWT）などの古い記述を修正。問い合わせ・ヘルプの画面の遷移とワイヤーフレームは引き続き未反映（各設計書の冒頭に注記） |
| 2026-10-05 | 主催者ごとのキャンセルポリシーの廃止を反映（マイグレーション 0020 で `workshops.cancellation_policy` を削除）。作成・編集フォームの入力欄を削除し、ワークショップ詳細・予約フォームの表示を本サービス共通の「キャンセルについて」の要約と `/help/cancellation-policy` へのリンクに、予約フォームの確認の文言を「ワークショップの内容とキャンセルについての案内を確認しました」に修正。対象: サイトマップ・画面遷移図・ワイヤーフレーム・ER 図・機能一覧表（あわせて `utils/payment.ts` などの行番号のずれを修正） |
| 2026-10-06 | Stripe Connect の廃止と、主催者への振込（売上と振込）を反映（マイグレーション 0021: `users.stripe_account_id` / `stripe_charges_enabled`・`payments.stripe_account_id` の削除、`payments.application_fee_amount` → `platform_fee_amount` の名前変更、`payments.facilitator_amount` の追加、`payout_bank_accounts` / `payout_requests` テーブルの追加）。画面 `/manage/payout` を「参加費の受け取り設定」から「売上と振込」に書き直し、運営向けの `/manage/payout-requests`（admin のみ）を追加。作成・編集画面の支払方法の判定（運営側の設定だけ）と受け取り設定へのリンクの削除、Webhook の `account.updated` の削除、API（`/api/facilitators/me/payouts/*`、`/api/admin/payout-requests*`）、機能カテゴリ PAYOUT（F-PAY-01〜03 は廃止として残す）、環境変数 `PAYOUT_MIN_AMOUNT` / `PAYOUT_TRANSFER_FEE`。対象: 全設計書（あわせて `App.tsx`・`main.py`・`config.py`・`payments.py` などの行番号のずれを修正） |
