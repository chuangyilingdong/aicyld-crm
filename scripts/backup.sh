#!/usr/bin/env bash
set -euo pipefail

# 备份 Twenty 数据库 + 本地附件卷
# 用法：bash scripts/backup.sh
# 可选：BACKUP_DIR=/opt/twenty/backups RETENTION_DAYS=7

BACKUP_DIR="${BACKUP_DIR:-/opt/twenty/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
PG_USER="${PG_DATABASE_USER:-postgres}"
PG_DB="${PG_DATABASE_NAME:-default}"
TS="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

docker exec twenty-postgres pg_dump -U "$PG_USER" "$PG_DB" \
  | gzip > "${BACKUP_DIR}/db-${TS}.sql.gz"

docker run --rm \
  -v twenty_server-local-data:/data:ro \
  -v "${BACKUP_DIR}:/backup" \
  alpine:3.20 \
  tar czf "/backup/files-${TS}.tar.gz" -C /data .

find "$BACKUP_DIR" -type f -name '*.gz' -mtime +"$RETENTION_DAYS" -delete

echo "备份完成：${BACKUP_DIR}/db-${TS}.sql.gz"
echo "          ${BACKUP_DIR}/files-${TS}.tar.gz"

# 可选：上传到阿里云 OSS（安装 ossutil 并设置 OSS_BUCKET 后启用）
# if command -v ossutil >/dev/null 2>&1 && [ -n "${OSS_BUCKET:-}" ]; then
#   ossutil cp "${BACKUP_DIR}/db-${TS}.sql.gz" "oss://${OSS_BUCKET}/twenty/backups/" -f
#   ossutil cp "${BACKUP_DIR}/files-${TS}.tar.gz" "oss://${OSS_BUCKET}/twenty/backups/" -f
# fi
