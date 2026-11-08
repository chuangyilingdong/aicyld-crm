# AICYLD CRM 部署仓库

Twenty CRM 自托管部署，独立于学习平台，只共用同一台服务器的 Nginx 和 Docker。

- 访问地址：**https://crm.aicyld.com**
- 服务器：`ai-kids-prod`（`8.138.150.19`）
- Twenty 版本：`v2.56.1`（固定版本，升级只改 `.env` 的 `TAG`）
- 数据：PostgreSQL + 本地附件卷，全部在这台服务器上

> 这个仓库只放部署配置，不 fork Twenty 源码。升级只需改版本号、拉镜像，不用维护 fork。

## 架构

```
浏览器
  │ HTTPS 443
  ▼
Nginx（现有，aicyld.com 也在用）
  │ proxy_pass 127.0.0.1:3000
  ▼
Twenty server ──► PostgreSQL 16（容器 twenty-postgres）
  │                Redis 7（容器 twenty-redis）
  └──► Twenty worker（后台任务/工作流）

附件：Docker volume twenty_server-local-data
```

现有学习平台仍走 `127.0.0.1:8789`，本仓库不修改它的 Nginx 配置。

## 目录

```
.
├─ docker-compose.yml          # Twenty 栈（server/worker/db/redis）
├─ .env.example                # 环境变量模板（真实 .env 只在服务器生成）
├─ nginx/
│  ├─ crm.aicyld.com.http.conf.template   # 首次签 SSL 用
│  ├─ crm.aicyld.com.conf.template        # 最终 HTTPS 反代
│  ├─ crm-rounds-panel.js                 # “N轮”当前页弹窗
│  └─ crm-insights.js                     # 待提醒角标 + 业务概览卡片/面板
├─ scripts/
│  ├─ install-docker.sh        # 安装 Docker + Compose（幂等）
│  ├─ deploy.sh                # 生成 .env、拉镜像、启动、健康检查
│  ├─ setup-nginx.sh           # 写 Nginx 配置 + Certbot 签证书
│  ├─ backup.sh                # 备份数据库 + 附件
│  └─ restore.sh               # 恢复（会覆盖数据库）
└─ docs/
   ├─ crm-config.md            # 对象/字段/阶段/视图/工作流配置清单
   └─ sop.md                   # 员工一页纸 SOP
```

## 一次性部署

### 1. DNS

阿里云云解析 → `aicyld.com` → 添加记录：

| 类型 | 主机记录 | 记录值 | TTL |
|---|---|---|---|
| A | `crm` | `8.138.150.19` | 600 |

验证：

```bash
nslookup crm.aicyld.com
```

### 2. 把仓库放到服务器

```bash
ssh ai-kids-prod
sudo mkdir -p /opt/twenty
# 从本地推上去（在本地仓库目录执行）
tar --exclude=.git -czf - . | ssh ai-kids-prod 'sudo tar -xzf - -C /opt/twenty'
```

### 3. 安装 Docker（如果还没装）

```bash
cd /opt/twenty
sudo bash scripts/install-docker.sh
```

### 4. 启动 Twenty

```bash
cd /opt/twenty
sudo bash scripts/deploy.sh
```

如果服务器拉不到 Docker Hub（本机就是这种情况），先按
[docs/offline-images.md](docs/offline-images.md) 从本地导入镜像，然后：

```bash
SKIP_PULL=1 sudo -E bash scripts/deploy.sh
```

首次会：

- 生成 `/opt/twenty/.env`（权限 600，含随机密钥）
- 拉取 `twentycrm/twenty:v2.56.1`
- 启动 server、worker、Postgres、Redis
- 等数据库迁移完成并通过 `/healthz`

检查：

```bash
docker compose ps
curl -fsS http://127.0.0.1:3000/healthz
```

### 5. Nginx + SSL

```bash
cd /opt/twenty
sudo bash scripts/setup-nginx.sh crm.aicyld.com admin@aicyld.com
```

脚本会：

- 备份已有的 `crm.aicyld.com` 配置（如果有）
- 先用 HTTP 配置完成 ACME 验证
- 用 Certbot 签发证书
- 换成最终 HTTPS 反代配置
- 安装续期后自动 reload Nginx 的 hook

验证：

```bash
curl -I https://crm.aicyld.com
```

### 6. 初始化工作区

浏览器打开 **https://crm.aicyld.com**：

1. 创建 workspace（建议名称 `AICYLD CRM`）
2. 创建管理员账号（用公司邮箱）
3. Settings → Experience → Language → 中文
4. 按 [docs/crm-config.md](docs/crm-config.md) 建对象、字段、阶段、视图

## 日常运维

```bash
cd /opt/twenty

docker compose ps                 # 状态
docker compose logs -f server     # 服务端日志
docker compose logs -f worker     # 工作流/后台任务日志
docker compose restart server     # 重启服务端
```

### 升级 Twenty

```bash
cd /opt/twenty
sudo bash scripts/backup.sh       # 先备份
# 改 .env 里的 TAG，例如 v2.56.1 -> v2.57.0
docker compose pull
docker compose up -d
curl -fsS http://127.0.0.1:3000/healthz
```

如果服务器拉不到 Docker Hub，按 [docs/offline-images.md](docs/offline-images.md) 本地导入新镜像，
然后 `SKIP_PULL=1 sudo -E docker compose up -d`。

**规则：先备份，再升级；数据库迁移只能向前，不能回退。**

### 备份

手动：

```bash
sudo bash scripts/backup.sh
```

每天 02:00 自动备份（crontab）：

```cron
0 2 * * * cd /opt/twenty && /usr/bin/bash scripts/backup.sh >> /var/log/twenty-backup.log 2>&1
```

备份在 `/opt/twenty/backups`，保留 7 天。建议再同步到阿里云 OSS（脚本里已留 `ossutil` 注释）。

### 恢复

```bash
sudo bash scripts/restore.sh /opt/twenty/backups/db-YYYYmmdd-HHMMSS.sql.gz \
  /opt/twenty/backups/files-YYYYmmdd-HHMMSS.tar.gz
```

会要求输入 `RESTORE` 确认；会停止 server/worker、重建数据库、恢复附件。

## 安全

- `.env` 权限 600，**不要提交到 Git**；仓库里只有 `.env.example`。
- 3000 只绑 `127.0.0.1`，公网只开 80/443。
- 阿里云安全组只放 80/443 和你的 SSH 来源 IP。
- 备份至少保留一份在另一台机器/OSS；不要只放本机。
- 固定版本号，不要用 `latest`。
- 不要用 root 日常登录；建议加普通用户 + sudo。
- 现有 `aicyld.com` 的 Nginx 配置不要动；本仓库只新增 `crm.aicyld.com` 一个站点。

## 资源与容量

| 项目 | 当前 |
|---|---|
| 服务器 | 4 核 / 7.4G 内存，可用约 6.3G |
| 磁盘 | 40G，部署前剩 9.9G |
| Twenty 常驻内存 | 约 1–1.5G |
| 首次镜像+数据 | 约 3–4G |
| 4 个用户 | 足够 |

磁盘装完预计剩 5–6G。附件多、备份多时：

1. 清理旧镜像：`docker image prune -a`
2. 扩云盘，或挂一块数据盘到 `/data`，把 Docker data-root 迁过去
3. 备份上传 OSS，不占本机

## 故障排查

| 现象 | 排查 |
|---|---|
| 502 Bad Gateway | `docker compose ps`，看 server 是否 healthy；`docker compose logs server` |
| 413 Request Entity Too Large | Nginx `client_max_body_size` 已设 50m；调大后 reload |
| 登录后跳转循环 | `.env` 的 `SERVER_URL` 必须和浏览器地址完全一致（`https://crm.aicyld.com`，结尾无 `/`） |
| WebSocket 连不上 | Nginx 必须带 `Upgrade`/`Connection` 头（模板已带） |
| 页面空白 | 检查证书、`curl -I`、浏览器控制台；确认不是把 Twenty 放到子路径 |
| 磁盘满 | `df -h`、`docker system df`；清理旧镜像/备份，扩盘 |
| 工作流不执行 | `docker compose ps` 确认 worker 在跑；看 worker 日志 |

## 参考

- [Twenty 官方仓库](https://github.com/twentyhq/twenty)
- [Docker Compose 自托管文档](https://docs.twenty.com/developers/self-host/capabilities/docker-compose)
- [子路径部署官方结论（不支持）](https://github.com/twentyhq/twenty/issues/29127)
- [权限文档](https://docs.twenty.com/zh/user-guide/permissions-access/capabilities/permissions)
