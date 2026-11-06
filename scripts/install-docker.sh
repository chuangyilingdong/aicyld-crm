#!/usr/bin/env bash
set -euo pipefail

# 在 Ubuntu 上安装 Docker Engine + Compose 插件（幂等）
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  echo "Docker 已安装：$(docker --version)"
  echo "Compose：$(docker compose version)"
  exit 0
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "请用 root 运行：sudo bash scripts/install-docker.sh" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq docker.io docker-compose-v2
systemctl enable --now docker

echo "Docker：$(docker --version)"
echo "Compose：$(docker compose version)"
