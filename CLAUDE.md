# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

対話型ワークショップの予約・管理システム（サービス名 TAIWA）。React + TypeScript + Tailwind v4 (Vite) のフロントエンドと、FastAPI + SQLAlchemy + MySQL のバックエンド。コード中のコメント・コミットメッセージ・UI 文言はすべて日本語。

## コマンド

開発環境は Windows（venv は `backend/venv/Scripts/`）。

```
# リポジトリルート: バックエンド(:8000)とフロントエンド(:5173)を同時起動
npm run dev

# バックエンド (backend/ で実行)
./venv/Scripts/python -m pytest                                   # 全テスト
./venv/Scripts/python -m pytest tests/test_reservations.py        # 1 ファイル
./venv/Scripts/python -m pytest tests/test_reservations.py -k cancel   # 名前で絞る
./venv/Scripts/python -m alembic upgrade head                     # マイグレーション適用
./venv/Scripts/python scripts/seed_sample_data.py                 # サンプルデータ(パスワードは全員 password123)
./venv/Scripts/python scripts/seed_bulk_workshops.py              # 一覧・検索・ページ送り確認用の50件(一時的。sample のあとに実行)
./venv/Scripts/python scripts/seed_bulk_workshops.py --delete     # ↑で作ったデータを消す(確認が済んだら必ず実行する)
./venv/Scripts/python scripts/seed_sample_notifications.py        # 通知一覧の確認用に sato@example.com へ全種類の通知(一時的。sample のあとに実行)
./venv/Scripts/python scripts/seed_sample_notifications.py --delete  # ↑で入れた通知を消す(確認が済んだら必ず実行する)
./venv/Scripts/python scripts/set_role.py you@example.com admin   # admin への昇格(admin は自己登録不可)

# フロントエンド (frontend/ で実行)
npm run build          # tsc -b && vite build(型チェックを兼ねる)
npm run lint           # oxlint
npm test               # vitest run
npx vitest run src/utils/workshop.test.ts   # 1 ファイル
```

- 変更後もフロントエンド :5173 とバックエンド :8000 は起動したままにしておく。
- Swagger UI: http://localhost:8000/docs
- 本番は AWS EC2 1 台（Nginx + uvicorn + MySQL 同居）。構築・更新・バックアップの手順と設定ファイルは [deploy/README.md](deploy/README.md)。

## アーキテクチャ

### 全体

- フロントエンドは `/api` へのリクエストを Vite の proxy でバックエンドへ転送する。全ルーターは `app/main.py` で `/api` プレフィックス付きで登録される。
- 認証は JWT の Bearer トークン（Cookie は使わない）。フロントは `localStorage` にトークンを保存し、`frontend/src/api/client.ts` の axios インターセプターで付与する。401 を受けると `AUTH_EXPIRED_EVENT` を発火して `AuthContext` がログアウトさせる。
- ロールは participant / facilitator / admin。ログイン画面はロール別（`/login/participant`, `/login/facilitator`）で、participant 画面は participant 以外を、facilitator 画面は facilitator 以外を拒否する（admin はどちらの画面からもログインできない）。
- リマインダー通知は `main.py` の lifespan で起動する APScheduler（30 分間隔）が送る。同じスケジューラーで、オンライン決済の返金の再試行と期限切れの支払い待ちの片付け（10 分間隔）も行う。複数プロセスでの二重実行は MySQL の `GET_LOCK` で防いでいる。
- 参加費のオンライン決済は運営の Stripe アカウントでの Stripe Checkout（Connect は使わない）。支払いごとに主催者の受取額（参加費の 90%）を記録し、主催者の申請を受けて運営が手作業で振り込む（`services/payouts.py`）。Stripe の呼び出しは `backend/app/core/stripe_client.py` に集め、決済の完了などは Webhook（`/api/stripe/webhook`、運営のアカウントのイベント）で受け取る。
- アップロード画像は `UPLOAD_DIR`（既定 `backend/uploads/`）に保存し、`/api/uploads` で配信。
- 起動時に `JWT_SECRET_KEY` が弱いと `settings.check_jwt_secret()` が警告/失敗する。設定は `backend/.env`（`.env.example` 参照）。

### バックエンド (`backend/app/`)

層の役割（routers は薄く・services に業務ロジック・commit はルーター）、エラー応答、権限、行ロック、日時、マイグレーション、テストの方針は [backend/CLAUDE.md](backend/CLAUDE.md) にまとめている。

### フロントエンド (`frontend/src/`)

フォルダごとの責務（画面・部品・フック・utils・api の分担と依存の向き）、置き場所の決め方、ファイルごとの役割は [frontend/CLAUDE.md](frontend/CLAUDE.md) にまとめている。

- import は `@/` エイリアス（`src` からのパス）で書く。
- API 呼び出しは `api/` にリソースごとの関数として置き、画面からは `apiClient` を直接使わない。エラー文言は `extractErrorMessage()` で取り出す。
- 共通フック（`hooks/`）を使う:
  - `useApiResource` — 取得・読み込み中・エラー・中断・再取得
  - `useAsyncAction` — ボタン操作などの実行中・失敗の扱い
  - `useImageSelection` — 画像の選択とプレビュー
  - `useBackState` — 戻るリンクの遷移元 state の受け渡し
- 共通 UI は `components/ui/`（`StatusMessage`, `BackLink`, `PaperCard`, `Pagination` など）と、クラス文字列をまとめた `components/ui/styles.ts`。読み込み中・エラー表示や主ボタンはここの部品・クラスを使う。
- グローバル state は `context/AuthContext.tsx` と `context/NotificationContext.tsx`。
- ロジックのテストは対象ファイルの隣に `*.test.ts`（Vitest）。テストデータは `src/test/factories.ts`。

## デザイン・文言

画面を追加・変更するときは `DESIGN.md` に従う。要点:

- 色はクラスに直接書かず、`index.css` の `@theme` トークン（`bg-surface`, `text-fg`, `bg-accent`, `border-border` など）を使う。`bg-white` や `text-slate-*` は使わない。紙面のカードは `theme-paper` の中に置く。
- トーンは「静かに寄り添う」。命令・煽り・感嘆符・絵文字は使わない。用語は **主催者**（「開催者」は使わない）／**参加者**。管理画面・規約・エラーメッセージは正確さを優先する。
- `DESIGN.md` とコードが食い違ったらコード（`index.css`, `components/ui/`）が正。

### Figma

- デザインシステムは Figma の「TAIWA Design System」（fileKey `Dyvi7vBf0rnae8EN8nLOb6`）。部品・トークン・画面とコードの対応は [FIGMA.md](FIGMA.md) にまとめている。Figma のノードは Figma MCP（`get_design_context` / `get_screenshot` / `get_variable_defs`）で読む。
- 画面・部品・トークンを変えたら、対応する Figma と `FIGMA.md` も直す。Figma 側の変更をコードに入れるときも、`FIGMA.md` で対応先を確かめる。

## 設計書・エージェント

- `docs/design/` に設計書（サイトマップ、画面遷移、ER 図など）がある。更新は `design-doc-writer` エージェントで行う。
- コード変更後のレビューには `.claude/agents/` の `frontend-code-reviewer` / `backend-code-reviewer` を使う。どちらも「責務の配置」の観点を持ち、`frontend/CLAUDE.md`・`backend/CLAUDE.md`（と `app/routers/`・`app/services/` の CLAUDE.md）に書いた役割を基準にする。フォルダやファイルの役割を変えたら、これらの CLAUDE.md も直す。
