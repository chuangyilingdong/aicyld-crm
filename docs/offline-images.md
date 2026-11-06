# 离线导入镜像（服务器拉不到 Docker Hub 时）

这台阿里云服务器的 DNS 对 Docker Hub 被污染，且跨境 TLS 会被 reset：

- `registry-1.docker.io` 被解析到 `162.125.8.1`（错误 IP）
- 用干净 DNS 拿到真实 IP 后，连接仍然被 reset
- 公共镜像源的 blob CDN 也经常超时

所以升级 / 首次安装时，可以在**本地电脑**用代理拉镜像，导出 tar，再传到服务器 `docker load`。

## 需要

- 本地电脑能访问 Docker Hub（代理/VPN）
- `crane`（[go-containerregistry](https://github.com/google/go-containerregistry/releases)，单文件）
- SSH 能连到 `ai-kids-prod`

## 1. 本地拉镜像

```bash
# 设置你的本地代理（按实际改）
export HTTPS_PROXY=http://127.0.0.1:7890
export HTTP_PROXY=http://127.0.0.1:7890

crane pull --platform linux/amd64 twentycrm/twenty:v2.56.1 twenty.tar
crane pull --platform linux/amd64 postgres:16 postgres.tar
crane pull --platform linux/amd64 redis:7 redis.tar
```

## 2. 传到服务器并加载

```bash
cat twenty.tar   | ssh ai-kids-prod 'docker load'
cat postgres.tar | ssh ai-kids-prod 'docker load'
cat redis.tar    | ssh ai-kids-prod 'docker load'
```

检查：

```bash
ssh ai-kids-prod 'docker images --format "{{.Repository}}:{{.Tag}} {{.Size}}"'
```

应看到：

```
twentycrm/twenty:v2.56.1
postgres:16
redis:7
```

## 3. 启动时跳过 pull

```bash
cd /opt/twenty
SKIP_PULL=1 sudo -E bash scripts/deploy.sh
```

## 升级时

1. 本地拉新版本：
   ```bash
   crane pull --platform linux/amd64 twentycrm/twenty:v2.57.0 twenty-v2.57.0.tar
   cat twenty-v2.57.0.tar | ssh ai-kids-prod 'docker load'
   ```
2. 服务器改 `/opt/twenty/.env` 的 `TAG=v2.57.0`
3. 备份后启动：
   ```bash
   sudo bash scripts/backup.sh
   SKIP_PULL=1 sudo -E docker compose up -d
   ```

> 不要用 `latest`。固定版本号，升级前备份；数据库迁移只能向前。

## 备注

- `crane pull` 生成的 tar 是 Docker load 兼容格式，layer 已经压缩，重复 gzip 收益很小。
- 如果本地没有代理，可以尝试阿里云容器镜像服务的“镜像加速器”（免费），把地址填到服务器的 `/etc/docker/daemon.json` 的 `registry-mirrors`。
- 公共镜像源（1ms、DaoCloud、1panel 等）只适合临时应急；生产建议用阿里云 ACR 或本地离线导入。
