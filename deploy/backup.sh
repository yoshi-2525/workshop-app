#!/bin/bash
# DB とアップロード画像を S3 に送る。cron で毎日実行する。
# DB の認証情報は ~/.my.cnf の [mysqldump] に置く(権限 600)。
# S3 への書き込みは EC2 に付けた IAM ロールで行う
set -euo pipefail

BUCKET="${BACKUP_BUCKET:?BACKUP_BUCKET に S3 バケット名を指定してください}"
TS=$(date +%Y%m%d-%H%M)
DUMP="/tmp/workshop-$TS.sql.gz"

mysqldump --single-transaction --routines workshop | gzip > "$DUMP"
aws s3 cp "$DUMP" "s3://$BUCKET/db/"
rm -f "$DUMP"

aws s3 sync /srv/taiwa/backend/uploads "s3://$BUCKET/uploads/"
