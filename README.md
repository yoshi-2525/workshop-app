# Workshop App

対話型ワークショップの予約・管理システム(サービス名 TAIWA)。

> **個人開発のプロジェクトです。**
> 実在するサービスとして運営しているものではありません。利用規約・キャンセルポリシー・特定商取引法に基づく表記・主催者ガイドラインは、
> アプリの動作に合わせて書いたもので、法的な確認は受けていません。オンライン決済(Stripe)はテスト環境で使う想定です。

## 使用技術

### フロントエンド

| 分類 | 技術 |
| --- | --- |
| 言語 | TypeScript 6 |
| UI ライブラリ | React 19 |
| ビルドツール | Vite 8 |
| スタイリング | Tailwind CSS v4(`@tailwindcss/vite`) |
| ルーティング | React Router 7 |
| HTTP クライアント | axios |
| テスト | Vitest |
| Lint | oxlint |

### バックエンド

| 分類 | 技術 |
| --- | --- |
| 言語 | Python |
| Web フレームワーク | FastAPI、Uvicorn(ASGI サーバー) |
| ORM・マイグレーション | SQLAlchemy 2.0、Alembic |
| DB | MySQL(ドライバーは PyMySQL) |
| バリデーション・設定 | Pydantic v2、pydantic-settings、python-dotenv |
| 認証 | JWT(PyJWT)の Bearer トークン、bcrypt(パスワードハッシュ) |
| 定期実行 | APScheduler(リマインダー通知、返金の再試行など) |
| 決済 | Stripe(Stripe Checkout、Webhook) |
| ファイルアップロード | python-multipart |
| テスト | pytest、httpx、SQLite(インメモリ DB) |

### 開発ツール

- concurrently(リポジトリルートの `npm run dev` でフロントエンドとバックエンドを同時起動)

## ディレクトリ構成

```
frontend/                 React SPA (Vite + TypeScript + TailwindCSS)
  src/
    api/                  バックエンドAPIクライアント(エンドポイントごとにファイル分割)
    components/           共通コンポーネント(Navbar, Layout, WorkshopCard など)
      auth/                 ログイン・登録フォームなど認証系コンポーネント
    context/               AuthContext / NotificationContext(グローバルstate)
    pages/                  ルーティング単位のページコンポーネント
      auth/                 ログイン・登録画面(participant / facilitator 別)
      manage/                facilitator 向けワークショップ管理画面
    types/                  共通の型定義
    utils/                  フォーマットや地図表示などのユーティリティ
  public/                 静的アセット

backend/                  FastAPI サーバー
  app/
    routers/                エンドポイント定義(auth, workshops, reservations, favorites, notifications, facilitators)
    schemas/                Pydanticスキーマ(リクエスト/レスポンス)
    models/                 SQLAlchemyモデル(user, workshop, reservation, favorite, notification)
    services/               ビジネスロジック(workshops, notifications, uploads)
    core/                   認証・認可まわりの共通処理(security, deps)
    main.py                 アプリのエントリーポイント
    config.py               環境変数・設定
    database.py             DB接続設定
  alembic/                マイグレーション
  scripts/                 運用スクリプト(set_role.py, seed_sample_data.py)
  uploads/                アップロードされたファイルの保存先
  schema.sql              初期テーブル定義
```

## 起動(2回目以降・DBセットアップ済みの場合)

初回セットアップ(下記)が完了していれば、リポジトリルートで以下を実行するだけで
バックエンド・フロントエンドが同時に起動します(DBの起動・作成は含みません)。

```
npm install   # 初回のみ。concurrently をインストール
npm run dev
```

- バックエンド: http://localhost:8000
- フロントエンド: http://localhost:5173

`Ctrl+C` で両方まとめて停止します。

## セットアップ

### DB

`backend/schema.sql` に必要なテーブル定義(users / workshops / reservations / favorites / notifications)があります。
MySQL に対象データベースを作成し、このSQLを流し込んでください。

```
CREATE DATABASE workshop CHARACTER SET utf8mb4;
mysql -u <user> -p workshop < backend/schema.sql
```

### バックエンド (FastAPI)

```
cd backend
python -m venv venv
./venv/Scripts/pip install -r requirements.txt   # Windows
# source venv/bin/activate && pip install -r requirements.txt  # macOS/Linux

cp .env.example .env   # DB_HOST / DB_USER / DB_PASSWORD などを環境に合わせて編集
./venv/Scripts/python -m uvicorn app.main:app --reload
```

API は `http://localhost:8000` で起動し、Swagger UI は `http://localhost:8000/docs`。

participant / facilitator は画面から自己登録できます。admin だけは自己登録できず、
既存ユーザーを以下のスクリプトで昇格させてください。

```
./venv/Scripts/python scripts/set_role.py you@example.com admin
```

動作確認用のサンプルデータ(facilitator 2名 / participant 5名 / admin 1名 / ワークショップ複数 / 予約複数)を
投入する場合は以下を実行します(既存データがあれば重複作成せずスキップします)。

```
./venv/Scripts/python scripts/seed_sample_data.py
```

#### テスト

API のテストは pytest で実行します。テストごとに SQLite のインメモリ DB を作るので、MySQL は不要です
(SQLite では行ロックが効かないため、同時実行の検証は含みません)。

```
./venv/Scripts/pip install -r requirements-dev.txt
./venv/Scripts/python -m pytest
```

### フロントエンド (React)

```
cd frontend
npm install
npm run dev
```

`http://localhost:5173` で起動し、`/api` へのリクエストは Vite の proxy 経由でバックエンド(`http://localhost:8000`)に転送されます。

#### テスト

`src/utils` などのロジックのテストは Vitest で実行します(テストは対象のファイルの隣に `*.test.ts` で置く)。

```
npm test
```

## ロールと機能

- **participant**: ワークショップ一覧の閲覧、予約、予約のキャンセル
- **facilitator**: 自分のワークショップの作成・編集・削除、予約状況の確認、売上の確認と振込の申請(`/manage/payout`)
- **admin**: 全ワークショップの管理、主催者からの振込の申請の処理(`/manage/payout-requests`)

### オンライン決済と振込

- 参加費は運営の Stripe アカウントで Stripe Checkout により受け取ります(Stripe Connect は使いません。主催者の受け取り設定は不要です)。
- 支払いごとに、参加費の 90%(`PLATFORM_FEE_PERCENT` で変更)を主催者の売上として記録します。Stripe の決済手数料は運営が負担します。
- 開催を終えた分の売上から、主催者が振込を申請します(最低額 `PAYOUT_MIN_AMOUNT`、振込手数料 `PAYOUT_TRANSFER_FEE` は主催者負担)。
  運営が銀行から手作業で振り込み、管理画面で「振込済み」にします。
- Webhook は Connect 用ではなく、運営のアカウントのイベントとして登録します
  (開発では `stripe listen --forward-to localhost:8000/api/stripe/webhook`)。

ログイン・登録画面はアカウント種別ごとに別URLです。

- 参加者: `/login/participant`, `/register/participant`
- 主催者: `/login/facilitator`, `/register/facilitator`(facilitator の自己登録用。admin はここからは作れません)
- `/login`, `/register` はどちらを選ぶかのアカウント種別選択画面です。

参加者ログイン画面では participant 以外のアカウントでのログインを拒否し、
主催者ログイン画面では facilitator / admin のみ許可します。
