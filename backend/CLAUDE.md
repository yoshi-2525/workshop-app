# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

バックエンド（FastAPI + SQLAlchemy 2.0 + Pydantic v2 + MySQL/PyMySQL + Alembic）のコード設計の方針。リポジトリ全体の構成と起動方法はルートの `CLAUDE.md` を参照。

## コマンド（backend/ で実行）

```
./venv/Scripts/python -m pytest                                        # 全テスト
./venv/Scripts/python -m pytest tests/test_reservations.py -k cancel   # 絞り込み
./venv/Scripts/python -m alembic upgrade head                          # マイグレーション適用
```

## 層の役割

ルーター・サービスの詳しい書き方とファイルごとの役割は、それぞれ `app/routers/CLAUDE.md` と `app/services/CLAUDE.md` にある。

### routers/ — 薄く保つ

ルーターがすることは次の流れだけにする。業務ルールの判定はここに書かず `services/` に置く。

1. `Depends` で DB セッション・ユーザーを受け取る（`get_current_user` / `get_current_user_optional` / `require_roles(...)`）
2. service の取得・判定・変更の関数を呼ぶ
3. `db.commit()` → `db.refresh()`
4. `to_xxx_read()` でレスポンススキーマに変換して返す（`response_model` を必ず指定する）

```python
workshop = get_managed_workshop(db, workshop_id, current_user, for_update=True)
cancel_workshop(db, workshop)
db.commit()
db.refresh(workshop)
return to_workshop_read(db, workshop, current_user)
```

同期 DB セッションを使うので、エンドポイントは `async def` にしない（スレッドプールで動かす）。

### services/ — 業務ルールと状態の変更

- **commit は呼び出し側（ルーター）で行う。** service は `db.add` / 属性の変更までにとどめ、docstring に「(commit は呼び出し側)」と書く。例外（`replace_image` など）とその理由は `app/services/CLAUDE.md` を参照。
- 状態の変更とそれに伴う通知は、同じトランザクションで確定させる（例: `cancel_workshop` が `add_cancellation_notices` を呼ぶ）。片方だけが残らないようにするため。
- 前提条件（「`lock_workshop` で取得したものを渡すこと」「flush してから呼ぶこと」など）は docstring に書く。
- 入力の形式チェックは schemas で済んでいる前提とし、service では「状態や他のデータに照らして許されるか」だけを判定する（例: `check_workshop_input`）。

### schemas/ — 入力の検証

- 入力の検証は Pydantic で完結させる。長さ・範囲は `Field(min_length=, max_length=, ge=, le=)` で必ず指定する。
- 文字列入力は `schemas/types.py` の `TrimmedStr`（前後の空白を除いてから長さを確かめる）を使う。パスワードには使わない。メールは `EmailAddress`。
- 日時の入力は `NaiveUTCDateTime`、出力は `UTCDateTime` を使う。
- 一覧のクエリは `PageQuery` を継承したモデルを `Annotated[..., Query()]` で受ける。`extra="forbid"` で未知のパラメータは 422 にする。
- 更新用スキーマに所有者 ID・ロール・作成日時など変更させない項目を含めない。
- 閲覧者によって変わる値は `viewer`（`WorkshopViewer`）のように分けて返す。特定の人にだけ見せる項目は、権限がなければ `None` にする（例: `participant_info`）。

### models/ — DB の定義

- SQLAlchemy 2.0 の `Mapped[...]` / `mapped_column` で書く。状態は `str, enum.Enum` で定義し、文字列を直書きしない。
- API と DB の両方で守る制約は、定数を1つ定義して両方で使う（例: `MAX_TICKETS_PER_RESERVATION` を CHECK 制約とスキーマの両方で使う）。
- 二重登録は一意制約で防ぐ（予約・お気に入り・通知など）。
- どの経路で更新しても必要な値は、ORM のイベントで設定する（例: `_set_published_at`）。

## エラー応答

- `HTTPException` を直接組み立てず、`core/errors.py` の `not_found()` / `forbidden()` / `conflict()` を使う。よく使うメッセージは同じファイルの定数（`WORKSHOP_NOT_FOUND` など）を使う。
- ステータスコードの使い分け:
  - **404**: 存在しない、または **見る権限がない**（存在を知られないよう 403 にしない。例: `get_viewable_workshop`、別のワークショップの予約 ID を指定された場合）
  - **403**: 存在は分かっていてよいが、操作する権限がない（例: `get_managed_workshop` で他人のワークショップ）
  - **409**: 業務ルール違反（定員超過、締め切り後、状態が許さない変更など）
  - **422**: 入力の形式違反（Pydantic に任せる）
- メッセージはユーザーにそのまま見せる日本語で、何をすればよいか分かるように書く（例: 「ワークショップを中止するには、編集画面の「中止する」を使ってください」）。

## 権限

- ロールの判定は `require_roles(UserRole.admin, UserRole.facilitator)` を Depends で使う。ルーター内で同じ組み合わせを何度も使うときは `_manager = require_roles(...)` のように変数にする。
- リソースの所有者チェックは service の取得関数にまとめ、ルーターに書かない:
  - `get_managed_workshop()` — 管理（編集・予約の管理）するワークショップ。存在しなければ 404、管理できなければ 403
  - `get_viewable_workshop()` — 詳細を見てよいワークショップ。見られなければ 404
  - `can_manage()` — admin か、そのワークショップの主催者本人か
- admin は自己登録できない（`scripts/set_role.py` で昇格する）。

## データの整合性

- 定員・状態が関わる処理は、`lock_workshop()`（`SELECT ... FOR UPDATE`）でワークショップの行をロックしてから予約数を数える。更新系では `get_managed_workshop(..., for_update=True)` を使う。ロックは commit / rollback で外れる。
- 「予約数（確定済みチケットの合計）」の定義は `confirmed_tickets_select()` だけに置く。ほかの場所で数え方を書かない。
- 一度公開したものは下書きに戻せない、中止は取り消せない、公開中は参加者が予約したときの条件（参加費・日時・場所）を変えられない、など参加者の目に触れた後の変更は制限する。
- 複数プロセスで二重に実行してはいけない定期処理は、MySQL の `GET_LOCK` で排他する（`services/notifications.py`）。

## 一覧とパフォーマンス

- レスポンスへの変換は `to_xxx_reads(db, items, current_user)` で複数件まとめて行い、件数に関係なく SQL の回数を一定にする。1件用の `to_xxx_read` はその薄いラッパーにする。
- 変換で関連を参照する場合は、呼び出し側で `selectinload` する（予約なら `RESERVATION_LOAD_OPTIONS`）。
- ページングは `services/pagination.py` の `paginate()` を使う。`limit` を指定したときだけページを分け、総件数を `X-Total-Count` ヘッダーで返す。
- 並び順には最後に `id` を付けて、同じ値のときの順序を固定する。
- LIKE 検索ではユーザー入力をエスケープする（`_escape_like` と `escape="\\"`）。生 SQL の `text()` にユーザー入力を埋め込まない。

## 日時

- DB には「タイムゾーンなしの UTC」で保存する（接続時に `time_zone = '+00:00'` に設定している）。
- 現在時刻は `core/timeutil.py` の `utcnow_naive()` を使う。`datetime.now()` を直接使わない。
- メッセージに時間を出すときは `hours_label()` を使う。

## 定数

- 上限値・締め切りなどのマジックナンバーは、モジュールの先頭で定数にする（`RESERVATION_DEADLINE_BEFORE`、`TITLE_MAX_LENGTH` など）。
- フロントエンドと同じ値を持つ定数には「フロントエンドの `utils/workshop.ts` の〜と揃える」とコメントを付け、変えるときは両方を直す。
- 環境で変わる値は `app/config.py` の `Settings` に置く（`.env` で上書き）。

## ファイルアップロード

`services/uploads.py` の `replace_image()` などを使う。画像の種類はクライアントの Content-Type ではなくファイル先頭のバイト列で判定し、保存名は UUID にする。リクエスト本文のサイズ上限は `main.py` の `BodySizeLimitMiddleware` で、受け取り中に断る。

## マイグレーション

スキーマを変えるときは次の3つをそろえる。

1. `alembic/versions/` に連番のファイルを追加する（`revision = "00NN"`、`down_revision` は直前の番号）。既存の行がある列の追加には `server_default` を付ける。
2. `models/` を更新する。
3. `schema.sql`（新規環境向けの全テーブル定義）を更新する。

既存のマイグレーションファイルは履歴なので書き換えない。

## テスト

- `tests/` は API を通した結合テスト。`conftest.py` がテストごとに SQLite のインメモリ DB を作り、`get_db` を差し替える（MySQL 不要）。
- フィクスチャ `make_user(role)` / `make_workshop(facilitator, **overrides)` でデータを作り、`auth_headers(user)` で認証する。
- テストは機能ごとにクラスにまとめる（`class TestReserve:`）。ファイル先頭の docstring に対象を書く。
- 権限のテストでは、許可されるロールだけでなく、他人・別ロール・未ログインで弾かれること（403 / 404 / 401）も確かめる。
- SQLite では `FOR UPDATE` / `GET_LOCK` が効かないので、同時実行の検証はテストに含めない。`TestClient` を `with` なしで使うので、スケジューラーは起動しない。

## コメント・文言

- コメント・docstring は日本語で、「何をするか」より「なぜそうするか（業務上の理由）」を書く。
- ユーザーに返す文言の用語はルートの `DESIGN.md` に合わせる（**主催者**／**参加者**。「開催者」は使わない）。

## レビュー

バックエンドを変更したら、`backend-code-reviewer` エージェント（`.claude/agents/backend-code-reviewer.md`）でセキュリティ・入力バリデーション・データ整合性・保守性を確認する。
