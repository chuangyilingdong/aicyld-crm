#!/usr/bin/env bash
set -euo pipefail

# 用法：bash scripts/restore.sh /opt/twenty/backups/db-YYYYmmdd-HHMMSS.sql.gz [files-....tar.gz]
# 警告：会停止 Twenty 并覆盖当前数据库，仅在确认后执行。
DB_BACKUP="${1:?用法: restore.sh <db.sql.gz> [files.tar.gz]}"
FILES_BACKUP="${2:-}"
cd "$(dirname "$0")/.."

if [ ! -f "$DB_BACKUP" ]; then
  echo "找不到数据库备份：$DB_BACKUP" >&2
  exit 1
fi
if [ -n "$FILES_BACKUP" ] && [ ! -f "$FILES_BACKUP" ]; then
  echo "找不到附件备份：$FILES_BACKUP" >&2
  exit 1
fi

echo "即将停止 Twenty，并用以下备份覆盖数据库："
echo "  DB:   $DB_BACKUP"
echo "  Files: ${FILES_BACKUP:-不恢复附件}"
read -r -p "确认请输入 RESTORE： " CONFIRM
[ "$CONFIRM" = "RESTORE" ] || { echo "已取消"; exit 1; }

PG_USER="${PG_DATABASE_USER:-postgres}"
PG_DB="${PG_DATABASE_NAME:-default}"

docker compose stop server worker

docker exec twenty-postgres psql -U "$PG_USER" -d postgres \
  -c "DROP DATABASE IF EXISTS \"${PG_DB}\" WITH (FORCE);"
docker exec twenty-postgres psql -U "$PG_USER" -d postgres \
  -c "CREATE DATABASE \"${PG_DB}\" OWNER \"${PG_USER}\";"

gunzip -c "$DB_BACKUP" | docker exec -i twenty-postgres psql -U "$PG_USER" -d "$PG_DB"

if [ -n "$FILES_BACKUP" ]; then
  BACKUP_ABS="$(cd "$(dirname "$FILES_BACKUP")" && pwd)"
  docker run --rm \
    -v twenty_server-local-data:/data \
    -v "${BACKUP_ABS}:/backup" \
    alpine:3.20 \
    sh -c "rm -rf /data/* && tar xzf /backup/$(basename "$FILES_BACKUP") -C /data"
fi

docker compose start server worker
echo "恢复完成。请检查：docker compose ps && curl -fsS http://127.0.0.1:3000/healthz"
