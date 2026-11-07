#!/usr/bin/env bash
set -euo pipefail

# 把每个客户的 lastContactAt 同步为最新一条沟通记录的 communicatedAt。
# 由服务器 cron 每分钟执行；不依赖 Twenty 工作流。
SCHEMA="$(docker exec twenty-postgres psql -At -U postgres -d default -c "SELECT table_schema FROM information_schema.columns WHERE table_schema LIKE 'workspace_%' AND table_name = 'person' AND column_name = 'lastContactAt' ORDER BY table_schema LIMIT 1;")"
if [ -z "$SCHEMA" ]; then
  echo "No workspace schema with person.lastContactAt found" >&2
  exit 0
fi

docker exec -i twenty-postgres psql -U postgres -d default -v ON_ERROR_STOP=1 <<SQL
UPDATE "$SCHEMA"."person" p
SET "lastContactAt" = s.max_at
FROM (
  SELECT "customerId", MAX("communicatedAt") AS max_at
  FROM "$SCHEMA"."_communicationRecord"
  WHERE "deletedAt" IS NULL
    AND "customerId" IS NOT NULL
    AND "communicatedAt" IS NOT NULL
  GROUP BY "customerId"
) s
WHERE p.id = s."customerId"
  AND p."deletedAt" IS NULL
  AND (p."lastContactAt" IS NULL OR p."lastContactAt" IS DISTINCT FROM s.max_at);

UPDATE "$SCHEMA"."person" p
SET "lastContactAt" = NULL
WHERE p."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "$SCHEMA"."_communicationRecord" c
    WHERE c."customerId" = p.id AND c."deletedAt" IS NULL
  );
SQL
