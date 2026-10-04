# Workshop App

対話型ワークショップの予約・管理システム。

- フロントエンド: React + TypeScript + TailwindCSS (Vite)
- バックエンド: Python (FastAPI)
- DB: MySQL

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

パスワードはすべて `password123` です。

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

## ロールと機能

- **participant**: ワークショップ一覧の閲覧、予約、予約のキャンセル
- **facilitator**: 自分のワークショップの作成・編集・削除、予約状況の確認
- **admin**: 全ワークショップの管理

ログイン・登録画面はアカウント種別ごとに別URLです。

- 参加者: `/login/participant`, `/register/participant`
- 主催者: `/login/facilitator`, `/register/facilitator`(facilitator の自己登録用。admin はここからは作れません)
- `/login`, `/register` はどちらを選ぶかのアカウント種別選択画面です。

参加者ログイン画面では participant 以外のアカウントでのログインを拒否し、
主催者ログイン画面では facilitator / admin のみ許可します。
