#!/usr/bin/env bash
set -euo pipefail

# 把每个客户的 lastContactAt 同步为「最高轮次」那条沟通记录的 communicatedAt
# （同一轮次取最新日期），避免录错日期的第1轮把最后沟通时间顶掉；
# 同时把 roundsLink（沟通轮次）更新为「N轮」并链接到该客户的沟通记录卡片视图。
# 由服务器 cron 每分钟执行；不依赖 Twenty 工作流。
SCHEMA="$(docker exec twenty-postgres psql -At -U postgres -d default -c "SELECT table_schema FROM information_schema.columns WHERE table_schema LIKE 'workspace_%' AND table_name = 'person' AND column_name = 'lastContactAt' ORDER BY table_schema LIMIT 1;")"
if [ -z "$SCHEMA" ]; then
  echo "No workspace schema with person.lastContactAt found" >&2
  exit 0
fi

CARD_VIEW_ID="913f2779-56a9-45fe-a491-0461031d670f"

docker exec -i twenty-postgres psql -U postgres -d default -v ON_ERROR_STOP=1 <<SQL
UPDATE "$SCHEMA"."person" p
SET "lastContactAt" = s.max_at
FROM (
  SELECT DISTINCT ON ("customerId")
         "customerId",
         "communicatedAt" AS max_at
  FROM "$SCHEMA"."_communicationRecord"
  WHERE "deletedAt" IS NULL
    AND "customerId" IS NOT NULL
    AND "communicatedAt" IS NOT NULL
  ORDER BY "customerId", "round" DESC NULLS LAST, "communicatedAt" DESC
) s
WHERE p.id = s."customerId"
  AND p."deletedAt" IS NULL
  AND (p."lastContactAt" IS NULL OR p."lastContactAt" IS DISTINCT FROM s.max_at);

UPDATE "$SCHEMA"."person" p
SET "lastContactAt" = NULL
WHERE p."deletedAt" IS NULL
  AND p."lastContactAt" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "$SCHEMA"."_communicationRecord" c
    WHERE c."customerId" = p.id AND c."deletedAt" IS NULL
  );

WITH counts AS (
  SELECT p.id,
         p."roundsLinkPrimaryLinkLabel" AS old_label,
         p."roundsLinkPrimaryLinkUrl" AS old_url,
         COUNT(c.id) AS cnt
  FROM "$SCHEMA"."person" p
  LEFT JOIN "$SCHEMA"."_communicationRecord" c
    ON c."customerId" = p.id AND c."deletedAt" IS NULL
  WHERE p."deletedAt" IS NULL
  GROUP BY p.id, p."roundsLinkPrimaryLinkLabel", p."roundsLinkPrimaryLinkUrl"
)
UPDATE "$SCHEMA"."person" p
SET "roundsLinkPrimaryLinkLabel" = counts.cnt::text || '轮',
    "roundsLinkPrimaryLinkUrl" = 'https://crm.aicyld.com/objects/communicationRecords?filter%5Bcustomer%5D%5BIS%5D%5BselectedRecordIds%5D%5B0%5D=' || p.id::text || '&viewId=$CARD_VIEW_ID'
FROM counts
WHERE p.id = counts.id
  AND (counts.old_label IS DISTINCT FROM counts.cnt::text || '轮'
       OR counts.old_url IS DISTINCT FROM 'https://crm.aicyld.com/objects/communicationRecords?filter%5Bcustomer%5D%5BIS%5D%5BselectedRecordIds%5D%5B0%5D=' || p.id::text || '&viewId=$CARD_VIEW_ID');

-- 新增沟通记录时自动算下一轮；标题留空时自动生成“第N轮-日期”。
CREATE OR REPLACE FUNCTION "$SCHEMA"."set_communication_round"()
RETURNS trigger
LANGUAGE plpgsql
AS \$\$
BEGIN
  IF NEW."round" IS NULL THEN
    SELECT COALESCE(MAX(c."round"), 0) + 1
      INTO NEW."round"
      FROM "$SCHEMA"."_communicationRecord" c
     WHERE c."customerId" = NEW."customerId"
       AND c."deletedAt" IS NULL;
  END IF;

  IF NEW."name" IS NULL OR btrim(NEW."name") = '' THEN
    NEW."name" := '第' || NEW."round"::text || '轮-' ||
      to_char(COALESCE(NEW."communicatedAt", now()) AT TIME ZONE 'Asia/Shanghai', 'FMMM"月"FMDD"日"');
  END IF;

  RETURN NEW;
END;
\$\$;

DO \$do\$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_communication_round'
      AND tgrelid = '"$SCHEMA"."_communicationRecord"'::regclass
  ) THEN
    CREATE TRIGGER "set_communication_round"
    BEFORE INSERT ON "$SCHEMA"."_communicationRecord"
    FOR EACH ROW EXECUTE FUNCTION "$SCHEMA"."set_communication_round"();
  END IF;
END
\$do\$;

-- 负责人变更时自动进“待提醒”，提醒新负责人及时处理。
CREATE OR REPLACE FUNCTION "$SCHEMA"."set_assignment_reminder"()
RETURNS trigger
LANGUAGE plpgsql
AS \$\$
DECLARE
  owner_label text;
BEGIN
  IF NEW."developer" IS DISTINCT FROM OLD."developer" AND NEW."developer" IS NOT NULL THEN
    SELECT opt->>'label'
      INTO owner_label
      FROM core."fieldMetadata" f
      CROSS JOIN LATERAL jsonb_array_elements(f.options) opt
     WHERE f.id = '7f995765-3860-42bf-8e01-23c6e3e55936'
       AND opt->>'value' = NEW."developer"::text
     LIMIT 1;

    NEW."nextReminderAt" := (DATE (now() AT TIME ZONE 'Asia/Shanghai') + time '09:00') AT TIME ZONE 'Asia/Shanghai';
    NEW."reminderText" := '【新指派' || COALESCE('给 ' || owner_label, '') || '】请及时联系客户';
    NEW."reminderAcknowledged" := false;
  END IF;

  RETURN NEW;
END;
\$\$;

DO \$do\$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_assignment_reminder'
      AND tgrelid = '"$SCHEMA"."person"'::regclass
  ) THEN
    CREATE TRIGGER "set_assignment_reminder"
    BEFORE UPDATE ON "$SCHEMA"."person"
    FOR EACH ROW EXECUTE FUNCTION "$SCHEMA"."set_assignment_reminder"();
  END IF;
END
\$do\$;

-- 提醒日期/内容变化时，自动取消“已确认”，让客户重新回到待提醒。
CREATE OR REPLACE FUNCTION "$SCHEMA"."reset_reminder_acknowledged"()
RETURNS trigger
LANGUAGE plpgsql
AS \$\$
BEGIN
  IF NEW."nextReminderAt" IS DISTINCT FROM OLD."nextReminderAt"
     OR NEW."reminderText" IS DISTINCT FROM OLD."reminderText" THEN
    NEW."reminderAcknowledged" := false;
  END IF;
  RETURN NEW;
END;
\$\$;

DO \$do\$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'reset_reminder_acknowledged'
      AND tgrelid = '"$SCHEMA"."person"'::regclass
  ) THEN
    CREATE TRIGGER "reset_reminder_acknowledged"
    BEFORE UPDATE ON "$SCHEMA"."person"
    FOR EACH ROW EXECUTE FUNCTION "$SCHEMA"."reset_reminder_acknowledged"();
  END IF;
END
\$do\$;

-- 沟通记录新增/修改/删除时，立即刷新客户的“最后沟通时间”和“N轮”。
CREATE OR REPLACE FUNCTION "$SCHEMA"."refresh_person_rollup"(p_id uuid)
RETURNS void
LANGUAGE plpgsql
AS \$\$
DECLARE
  v_count integer;
  v_last timestamptz;
  v_url text;
BEGIN
  IF p_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM "$SCHEMA"."_communicationRecord"
  WHERE "customerId" = p_id AND "deletedAt" IS NULL;

  SELECT c."communicatedAt" INTO v_last
  FROM "$SCHEMA"."_communicationRecord" c
  WHERE c."customerId" = p_id
    AND c."deletedAt" IS NULL
    AND c."communicatedAt" IS NOT NULL
  ORDER BY c."round" DESC NULLS LAST, c."communicatedAt" DESC
  LIMIT 1;

  v_url := 'https://crm.aicyld.com/objects/communicationRecords?filter%5Bcustomer%5D%5BIS%5D%5BselectedRecordIds%5D%5B0%5D=' || p_id::text || '&viewId=$CARD_VIEW_ID';

  UPDATE "$SCHEMA"."person" p
  SET "lastContactAt" = v_last,
      "roundsLinkPrimaryLinkLabel" = v_count::text || '轮',
      "roundsLinkPrimaryLinkUrl" = v_url
  WHERE p.id = p_id
    AND (p."lastContactAt" IS DISTINCT FROM v_last
      OR p."roundsLinkPrimaryLinkLabel" IS DISTINCT FROM v_count::text || '轮'
      OR p."roundsLinkPrimaryLinkUrl" IS DISTINCT FROM v_url);
END;
\$\$;

CREATE OR REPLACE FUNCTION "$SCHEMA"."on_communication_change"()
RETURNS trigger
LANGUAGE plpgsql
AS \$\$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM "$SCHEMA"."refresh_person_rollup"(OLD."customerId");
    RETURN OLD;
  END IF;

  PERFORM "$SCHEMA"."refresh_person_rollup"(NEW."customerId");

  IF TG_OP = 'UPDATE' AND OLD."customerId" IS DISTINCT FROM NEW."customerId" THEN
    PERFORM "$SCHEMA"."refresh_person_rollup"(OLD."customerId");
  END IF;

  RETURN NEW;
END;
\$\$;

DO \$do\$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'refresh_person_rollup_after_communication'
      AND tgrelid = '"$SCHEMA"."_communicationRecord"'::regclass
  ) THEN
    CREATE TRIGGER "refresh_person_rollup_after_communication"
    AFTER INSERT OR DELETE OR UPDATE OF "customerId", "round", "communicatedAt", "deletedAt"
    ON "$SCHEMA"."_communicationRecord"
    FOR EACH ROW EXECUTE FUNCTION "$SCHEMA"."on_communication_change"();
  END IF;
END
\$do\$;
SQL
