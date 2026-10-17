# 本番環境(AWS EC2 1 台)

EC2 1 台に Nginx・uvicorn・MySQL を同居させる構成。アップロード画像も同じ EBS に置く。バックアップは EBS スナップショットでサーバーごと取る。

```
ブラウザ ─HTTPS→ Nginx ─┬ /       → frontend/dist
                        └ /api/*  → uvicorn 127.0.0.1:8000 ─→ MySQL 127.0.0.1:3306
                                         └ backend/uploads/
```

| ファイル | 置き場所 |
|---|---|
| `taiwa.service` | `/etc/systemd/system/taiwa.service` |
| `nginx-taiwa.conf` | `/etc/nginx/sites-available/taiwa` |
| `mysql-taiwa.cnf` | `/etc/mysql/mysql.conf.d/zz-taiwa.cnf` |
| `update.sh` | リポジトリのまま、更新のたびに実行 |

## 1. AWS の準備

- EC2: Ubuntu 24.04、t4g.small(メモリ 2GB)以上、EBS gp3 20〜30GB。Elastic IP を割り当てる。
- セキュリティグループ: 80・443 は全体、22 は自分の IP だけ。3306 は開けない。
- ドメインの A レコードを Elastic IP に向ける。

## 2. パッケージ

```bash
sudo apt update && sudo apt install -y nginx mysql-server git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
curl -LsSf https://astral.sh/uv/install.sh | sh   # Python 3.14 を入れるのに使う(Ubuntu 標準は 3.12)
source $HOME/.local/bin/env                        # いまのシェルで uv を使えるようにする
```

スワップ 2GB(MySQL と同居するのでメモリ不足で落ちないように):

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 3. MySQL

```bash
sudo mysql_secure_installation
sudo cp /srv/taiwa/deploy/mysql-taiwa.cnf /etc/mysql/mysql.conf.d/zz-taiwa.cnf   # 4. の clone のあとで
sudo systemctl restart mysql
sudo mysql
```

```sql
CREATE DATABASE workshop CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'taiwa'@'localhost' IDENTIFIED BY '<長いランダムなパスワード>';
GRANT ALL PRIVILEGES ON workshop.* TO 'taiwa'@'localhost';
FLUSH PRIVILEGES;
```

## 4. アプリ

```bash
sudo mkdir -p /srv/taiwa && sudo chown ubuntu:ubuntu /srv/taiwa
git clone <リポジトリ> /srv/taiwa

cd /srv/taiwa/backend
uv venv --python 3.14 venv
uv pip install --python venv/bin/python -r requirements.txt
cp .env.example .env   # 下の項目を本番の値にする

cd /srv/taiwa/frontend && npm ci && npm run build
```

`backend/.env` で本番用に変える項目:

```env
APP_ENV=production
DB_HOST=127.0.0.1
DB_USER=taiwa
DB_PASSWORD=<3. で決めたパスワード>
DB_NAME=workshop
JWT_SECRET_KEY=<python -c "import secrets; print(secrets.token_urlsafe(48))" の出力>
CORS_ORIGINS=https://your-domain.example
FRONTEND_BASE_URL=https://your-domain.example
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

`APP_ENV=production` にすると、`JWT_SECRET_KEY` が弱いときや `FRONTEND_BASE_URL` が https でないときに起動が止まる。

```bash
cd /srv/taiwa/backend
./venv/bin/python -m alembic upgrade head
```

動作確認のためにサンプルデータを入れるときは `./venv/bin/python scripts/seed_sample_data.py`。サンプルのアカウントは全員パスワードが `password123` で誰でもログインできるので、実際に公開する前に DB を作り直して消す(`DROP DATABASE` → `CREATE DATABASE` → `alembic upgrade head`、`uploads/workshops/sample-*` も削除)。

## 5. 常駐と公開

```bash
sudo cp /srv/taiwa/deploy/taiwa.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now taiwa
curl http://127.0.0.1:8000/api/health

sudo cp /srv/taiwa/deploy/nginx-taiwa.conf /etc/nginx/sites-available/taiwa
sudo sed -i 's/your-domain.example/<実際のドメイン>/' /etc/nginx/sites-available/taiwa
sudo ln -s /etc/nginx/sites-available/taiwa /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <実際のドメイン>
```

admin は画面から登録したあとで昇格する:

```bash
cd /srv/taiwa/backend && ./venv/bin/python scripts/set_role.py you@example.com admin
```

## 6. Stripe

ダッシュボードで Webhook エンドポイント `https://<ドメイン>/api/stripe/webhook` を登録し、`checkout.session.completed` / `checkout.session.expired` / `charge.refund.updated` / `refund.failed` を選ぶ。表示された `whsec_...` を `.env` の `STRIPE_WEBHOOK_SECRET` に入れて `sudo systemctl restart taiwa`。

## 7. バックアップ

EBS スナップショットでサーバーごと戻せるようにする。DB と画像は同じ EBS にあるので、まとめて残る。

1. EC2 コンソール →「ライフサイクルマネージャー」→「ライフサイクルポリシーを作成」→「EBS スナップショットポリシー」
2. 対象: インスタンス。EC2 に付けたタグ(例 `Backup=taiwa`)で選ぶ
3. IAM ロール: デフォルトロール(初回は自動で作られる)
4. スケジュール: 24 時間ごと、開始時刻は利用の少ない時間(UTC で指定)、保持は 7 個程度

スナップショットは稼働中に取るので、MySQL から見ると電源が落ちた直後と同じ状態になる。InnoDB は起動時に自動で回復するので、個人開発の規模ならこれで足りる。

戻すときは、スナップショットから AMI を作ってインスタンスを起動し、Elastic IP を付け替える(またはスナップショットからボリュームを作って入れ替える)。一度は試しておく。

## 更新

```bash
cd /srv/taiwa && bash deploy/update.sh
```

pull・依存の更新・マイグレーション・フロントのビルド・再起動をまとめて行う。再起動の数秒間は API が応答しない。

## 運用

- OS と MySQL のセキュリティ更新: `sudo apt install unattended-upgrades` で自動にする。
- ログ: `journalctl -u taiwa -f`(バックエンド)、`/var/log/nginx/`(アクセス・エラー)。
- 利用が増えたら、`mysqldump` のデータを RDS に移して `.env` の `DB_HOST` を変えれば DB だけ切り出せる。
