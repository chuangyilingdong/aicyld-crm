#!/usr/bin/env bash
set -euo pipefail

# 启动 Twenty。首次运行会生成 .env（含随机密钥），之后不会覆盖。
cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker 未安装，请先运行：sudo bash scripts/install-docker.sh" >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose 插件不可用，请先运行：sudo bash scripts/install-docker.sh" >&2
  exit 1
fi

if [ ! -f .env ]; then
  umask 077
  cat > .env <<EOF
TAG=${TAG:-v2.56.1}
SERVER_URL=${SERVER_URL:-https://crm.aicyld.com}
PG_DATABASE_USER=postgres
PG_DATABASE_PASSWORD=$(openssl rand -hex 32)
PG_DATABASE_HOST=db
PG_DATABASE_PORT=5432
PG_DATABASE_NAME=default
REDIS_URL=redis://redis:6379
REDIS_CACHE_PREFIX=
ENCRYPTION_KEY=$(openssl rand -base64 32)
APP_SECRET=$(openssl rand -hex 32)
STORAGE_TYPE=local
TZ=Asia/Shanghai
EOF
  echo "已生成 .env（权限 600），真实密钥只保存在服务器上。"
else
  echo ".env 已存在，保留原值。"
fi
chmod 600 .env

if [ "${SKIP_PULL:-0}" = "1" ]; then
  echo "SKIP_PULL=1，跳过拉取，使用本地已加载的镜像。"
else
  echo "拉取镜像..."
  docker compose pull
fi

# 防止镜像没拉全就启动，直接给出明确错误
mapfile -t IMAGES < <(docker compose config --images)
for img in "${IMAGES[@]}"; do
  if ! docker image inspect "$img" >/dev/null 2>&1; then
    echo "缺少镜像：$img" >&2
    echo "如果服务器拉不到 Docker Hub，请参考 docs/offline-images.md 从本地导入。" >&2
    exit 1
  fi
done

echo "启动容器..."
docker compose up -d

echo "等待 Twenty 健康检查（最多 10 分钟，首次会跑数据库迁移）..."
for _ in $(seq 1 120); do
  if curl -fsS http://127.0.0.1:3000/healthz >/dev/null 2>&1; then
    echo "Twenty 已健康。"
    docker compose ps
    exit 0
  fi
  sleep 5
done

echo "10 分钟内未通过健康检查。请查看日志：" >&2
echo "  docker compose logs -f server" >&2
exit 1
