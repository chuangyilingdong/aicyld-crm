#!/usr/bin/env bash
set -euo pipefail

# 用法：sudo bash scripts/setup-nginx.sh [域名] [Let's Encrypt 邮箱]
# 默认：crm.aicyld.com / admin@aicyld.com
DOMAIN="${1:-crm.aicyld.com}"
EMAIL="${2:-admin@aicyld.com}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NGINX_AVAILABLE="/etc/nginx/sites-available/${DOMAIN}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${DOMAIN}"
WEBROOT="/var/www/certbot"

if [ "$(id -u)" -ne 0 ]; then
  echo "请用 root 运行：sudo bash scripts/setup-nginx.sh ${DOMAIN} ${EMAIL}" >&2
  exit 1
fi
command -v nginx >/dev/null 2>&1 || { echo "Nginx 未安装" >&2; exit 1; }
command -v certbot >/dev/null 2>&1 || { echo "Certbot 未安装" >&2; exit 1; }

mkdir -p "$WEBROOT"
mkdir -p /etc/letsencrypt/renewal-hooks/deploy

# 备份已有配置，避免覆盖别人的站点
if [ -f "$NGINX_AVAILABLE" ]; then
  cp -a "$NGINX_AVAILABLE" "${NGINX_AVAILABLE}.bak.$(date +%Y%m%d-%H%M%S)"
fi

# 1) 先上 HTTP 配置，只用于 ACME 验证和跳转
sed "s|__DOMAIN__|${DOMAIN}|g" "${REPO_DIR}/nginx/crm.aicyld.com.http.conf.template" > "$NGINX_AVAILABLE"
ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"
nginx -t
systemctl reload nginx

# 2) 签发证书（已有且未到期则跳过）
if [ ! -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
  certbot certonly --webroot -w "$WEBROOT" -d "$DOMAIN" \
    --non-interactive --agree-tos -m "$EMAIL" --keep-until-expiring
fi

# 3) 换成最终 HTTPS 配置
sed "s|__DOMAIN__|${DOMAIN}|g" "${REPO_DIR}/nginx/crm.aicyld.com.conf.template" > "$NGINX_AVAILABLE"
nginx -t
systemctl reload nginx

# 4) 证书续期后自动 reload Nginx
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<'EOF'
#!/usr/bin/env bash
systemctl reload nginx
EOF
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

echo "Nginx + SSL 已就绪：https://${DOMAIN}"
