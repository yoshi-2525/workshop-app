#!/bin/bash
# main の最新をサーバーに反映する。EC2 上で /srv/taiwa から実行する
set -euo pipefail
cd /srv/taiwa

git pull --ff-only

(cd backend && uv pip install --python venv/bin/python -r requirements.txt)
(cd backend && ./venv/bin/python -m alembic upgrade head)
(cd frontend && npm ci && npm run build)

sudo systemctl restart taiwa
curl -fsS http://127.0.0.1:8000/api/health > /dev/null && echo "バックエンドの起動を確認しました"
