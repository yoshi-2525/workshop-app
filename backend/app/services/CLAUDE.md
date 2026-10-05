# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`app/services/` は業務ロジックの置き場所。「誰が・いつ・何をできるか」の判定、状態の変更、それに伴う通知、DB からの取得とレスポンスへの変換をここに置く。ルーター側の書き方は `app/routers/CLAUDE.md`、バックエンド全体の方針は `backend/CLAUDE.md` を参照。

## service に置くもの

- **取得と権限の判定**: `get_xxx()` 関数。存在しない・見られないものは 404、管理できないものは 403 を投げる（例: `get_managed_workshop`、`get_viewable_workshop`、`get_my_inquiry`）
- **業務ルールの判定**: `ensure_xxx()` / `check_xxx()` 関数。許されなければ `conflict()`（409）を投げ、許されれば何も返さない（例: `ensure_editable`、`check_workshop_input`、`ensure_inquirable`）
- **状態の変更**: 動詞の関数（`create_reservation`、`cancel_workshop`、`record_attendance`）。判定から変更、通知の追加までをまとめて行う
- **SELECT の組み立て**: `xxx_select()` 関数。`Select` を返し、実行・ページングは呼び出し側に任せる（例: `public_workshops_select`、`my_inquiries_select`、`followed_workshops_select`）
- **レスポンスへの変換**: `to_xxx_reads()` / `to_xxx_read()`

## 守ること

### commit は呼び出し側

service は `db.add` / 属性の変更 / `db.flush()` までにとどめ、`db.commit()` はルーターで行う。docstring に「(commit は呼び出し側)」と書く。こうすると、ルーターが複数の service を1つのトランザクションでまとめられ、途中で失敗したら全体が取り消される。

例外として、service の中で commit しているもの:

- `uploads.replace_image()` — commit に失敗したら新しい画像ファイルを消し、成功したら古い画像ファイルを消す必要があり、DB の確定とファイル操作の順序を service 内で決めるため
- `follows.follow_facilitator()` / `unfollow_facilitator()` — 同時に同じフォローを作ったときの `IntegrityError` を成功として扱うため
- `notifications.send_upcoming_reminders()` — ルーターを通らない定期処理のため
- `payments.start_payout_onboarding()` — Stripe に作った連結アカウントの ID を、受け取り設定の URL を作る前に確定させるため（URL の作成に失敗してもアカウントを失わない）
- `payments.start_checkout()` / `reservations.resume_checkout()` — 席の確保を確定してワークショップの行ロックを外してから Stripe を呼び、結果をもう一度確定するため（外部 API を待つ間ロックを持ち続けない）
- `payments.process_refund()` / `expire_open_checkouts()` — 取消・中止を確定した後や定期処理から Stripe を呼び、1件ずつ結果を確定させるため（途中で失敗しても、済んだ返金の記録は残る）

新しく commit する service を作るときは、理由を docstring に書く。

### 状態の変更と通知は同じトランザクションで

状態の変更に伴う通知・メッセージは、変更する service の中で追加し、同じ commit で確定させる。片方だけが残ると、参加者が「中止になったのに通知が来ない」「通知が来たのに中止になっていない」状態になる。

- `cancel_workshop` → `add_cancellation_notices`
- `cancel_reservation` → `add_reservation_canceled_notice`
- `notify_if_first_published` → `add_new_workshop_notices`

### 前提条件を docstring に書く

呼び出し側が守らないと壊れる前提は、docstring に「〜を渡すこと」「〜してから呼ぶこと」と書く。

- 「workshop は `lock_workshop` で取得したものを渡すこと」— 予約数を数える・通知の対象を決める関数（`cancel_workshop`、`cancel_reservation`、`check_workshop_input` の更新時、`broadcast_to_participants`）
- 「flush してから呼ぶこと」— id が必要な関数（`notify_if_first_published` の新規作成時）
- 「`get_viewable_workshop` で取得したものを渡すこと」— `ensure_inquirable`

### 同時実行

- 定員・予約数・通知の対象が関わる処理は、`lock_workshop()` でワークショップの行をロックしてから数える。
- 「なければ作る」は一意制約に頼り、`IntegrityError` を受けて読み直す。それまでの追加を取り消したくない場合は `db.begin_nested()`（セーブポイント）の中で作る（`get_or_create_inquiry`）。
- 複数プロセスで二重に動かしてはいけない処理は、`job_lock.named_lock()`（MySQL の `GET_LOCK` を専用の接続で持つ）で囲む（`send_upcoming_reminders`、`run_payment_maintenance`）。

### 定義は1か所に

- 予約数（確保済みチケットの合計。確定済みと期限内の支払い待ち）: `workshops.reserved_tickets_select()` / `holds_seat()`
- 予約の締め切り: `workshops.RESERVATION_DEADLINE_BEFORE` / `reservation_deadline()`
- 管理できるか: `workshops.can_manage()`
- 取消の理由ごとの返金額: `payments.refund_amount_for()`（主催者都合は全額、参加者都合は決済手数料と運営の手数料を差し引く）
- お知らせ・リマインダーの送り先: `participants.confirmed_participant_ids()`（主催者本人は含めない）

同じ条件を別の場所で書き直さず、これらを使う。フロントエンドと同じ値を持つ定数には「フロントエンドの `utils/workshop.ts` の〜と揃える」とコメントを付ける。

### 変換は複数件まとめて

`to_xxx_reads(db, items, current_user)` は、件数に関係なく SQL の回数が一定になるように書く（`IN` で集計してから組み立てる）。1件用の `to_xxx_read` は `to_xxx_reads(db, [item], ...)[0]` の薄いラッパーにする。関連を参照する場合は、呼び出し側が付けるべき `selectinload` を `XXX_LOAD_OPTIONS` として定義し、docstring で案内する。

### service どうしの依存

`workshops.py` が土台で、ほかの service はここの関数を使う。`notifications.py` は `inquiries.py` を、`workshops.py` は `notifications.py` を使う。循環 import にならないよう、新しい関数は依存される側（より土台に近いファイル）に置く。

```
pagination  participants  uploads  job_lock （どこにも依存しない）
payments ─→ notifications                 （Stripe の呼び出しは core/stripe_client だけ）
inquiries ─→ participants
notifications ─→ inquiries, participants
workshops ─→ notifications, payments
reservations ─→ workshops, notifications, payments
stripe_webhooks ─→ reservations, payments
related / follows ─→ workshops
```

## ファイルごとの役割

| ファイル | 役割 | 主な関数 |
|---|---|---|
| `workshops.py` | ワークショップの土台。行ロック・管理権限・閲覧権限、作成・更新の可否、中止、公開時の通知、公開一覧の検索、予約数の定義、レスポンスへの変換。参加者向けの案内（`participant_info`）は予約済みの参加者と主催者・運営にだけ返す | `lock_workshop`, `get_managed_workshop`, `get_viewable_workshop`, `ensure_editable`, `check_workshop_input`, `cancel_workshop`, `public_workshops_select`, `reserved_tickets_select`, `to_workshop_reads` |
| `reservations.py` | 予約の作成（締め切り・自分の主催・重複・キャンセル済みからの再予約・定員を確認。オンライン決済なら支払い待ちで席を確保し、期限切れの行は使い回す）、決済の完了・期限切れの反映（完了時は行ロックして定員を確かめ、確定できなければ全額返金の対象にする）、支払いの取りやめ、主催者によるキャンセル（理由を記録し、支払い済みなら返金の対象にする）、返金と支払い待ちの片付けの定期処理、出欠の記録（開始 24 時間前から、開催後も修正可）、レスポンスへの変換 | `create_reservation`, `confirm_paid_checkout`, `run_payment_maintenance`, `apply_checkout_state`, `sync_pending_payment`, `abandon_payment`, `cancel_reservation`, `record_attendance`, `get_workshop_reservation`, `get_my_reservation`, `to_reservation_reads` |
| `stripe_webhooks.py` | Stripe の Webhook イベント（決済の完了・期限切れ、返金の失敗、連結アカウントの更新）の反映。処理したイベントの ID を `stripe_events` に記録して二重に反映しない | `handle_stripe_event` |
| `job_lock.py` | 複数プロセスで同時に動かしてはいけない定期処理のための、MySQL の名前付きロック | `named_lock` |
| `notifications.py` | 通知の作成。中止・予約キャンセル・フォロー中の主催者の新着・開催前日のリマインダー。`_add_missing` で同じ種類の通知を同じ人に二度作らない。リマインダーと一緒に、当日の案内を主催者からのメッセージとして送る | `add_cancellation_notices`, `add_reservation_canceled_notice`, `add_new_workshop_notices`, `send_upcoming_reminders` |
| `inquiries.py` | 参加者と主催者のやり取り。関わっている人だけが見られる（それ以外は 404）、既読位置（`*_last_read_id`）による未読数、メッセージの追加、一斉送信（公開中のワークショップの、予約が確定している参加者全員へ） | `get_my_inquiry`, `my_inquiries_select`, `unread_count`, `add_message`, `mark_read`, `get_or_create_inquiry`, `send_participant_inquiry`, `broadcast_to_participants` |
| `follows.py` | 主催者のフォロー。対象は `FOLLOWABLE_ROLE`（主催者）だけで、自分自身はフォローできない。フォロー中の主催者の開催予定は、公開一覧と同じ条件を使う | `follow_facilitator`, `unfollow_facilitator`, `is_following`, `followed_facilitators_select`, `followed_workshops_select` |
| `related.py` | 詳細ページの「関連するワークショップ」。同じ主催者 → 類似（文字 bigram の TF-IDF コサイン類似度）→ 近く（同じ会場 > 市区町村 > 都道府県。オンラインは他のオンライン）の順に選び、上の欄で選んだものは下の欄から除く。候補は `CANDIDATE_LIMIT` 件まで | `related_workshops` |
| `payments.py` | 参加費のオンライン決済（Stripe Connect の direct charge）。主催者の受け取り設定（連結アカウントの作成・状態の同期）、支払いの記録（金額・手数料）と Checkout の作成・再開。Stripe の失敗は `_stripe_call()` で 503 に変える。ワークショップの行ロックや定員が要る判定は `reservations.py` に置く | `payout_account_status`, `sync_payout_account`, `start_payout_onboarding`, `payout_dashboard_url`, `apply_account_state`, `add_payment`, `start_checkout`, `refund_amount_for`, `request_refund`, `process_refund`, `process_pending_refunds`, `expire_open_checkouts` |
| `participants.py` | 予約が確定している参加者の ID（お知らせの送り先） | `confirmed_participant_ids` |
| `uploads.py` | 画像の保存・削除。種類はファイル先頭のバイト列で判定（jpg / png / gif / webp）、サイズは読みながら上限を確認、保存名は UUID。`ImageStore` ごとにサブディレクトリを分ける（`WORKSHOP_IMAGES`、`AVATAR_IMAGES`）。このアプリが保存した URL 以外は消さない | `replace_image`, `ImageStore.save` / `delete`, `max_request_body_bytes` |
| `pagination.py` | 一覧のページ分けと `X-Total-Count` ヘッダー | `paginate` |

## 新しい機能を追加するとき

1. 判定と状態の変更は、まず既存の service に置けないか考える（ワークショップに関するものは `workshops.py`）。新しいリソースなら、そのリソース名のファイルを作る。
2. 通知を伴うなら、通知の追加は `notifications.py` に `add_xxx_notices` として置き、状態を変える service から呼ぶ。
3. 取得関数で権限を判定し、ルーターには判定を書かせない。
4. 業務ルールの判定ごとにテスト（`tests/`）を追加し、許されないケースが 409 になることを確かめる。
