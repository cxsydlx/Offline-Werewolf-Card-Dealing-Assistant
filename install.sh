#!/bin/bash
set -e

# ==============================================
#  狼人杀·熟人局助手 — 一键安装脚本
#  适用: Ubuntu 24.04 LTS
#  用法: chmod +x install.sh && sudo ./install.sh
# ==============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info() { echo -e "${CYAN}[•]${NC} $1"; }

APP_DIR="/opt/weblangrensha"
APP_PORT=3001
MYSQL_USER="werewolf"
MYSQL_PASS="biB8mGZr5DdpN7ZD"
MYSQL_DB="weblangrensha"

echo ""
echo "🐺==============================================🐺"
echo "   狼人杀·熟人局助手 — 一键安装"
echo "   目标系统: Ubuntu 24.04 LTS"
echo "🐺==============================================🐺"
echo ""

# ---- 检查 root ----
if [ "$EUID" -ne 0 ]; then
  warn "建议用 sudo 运行，否则部分步骤可能失败"
fi

# ==============================================
# 1. 安装 Node.js 22.x
# ==============================================
info "检查 Node.js..."
if command -v node &>/dev/null; then
  log "Node.js $(node --version) 已安装"
else
  warn "正在安装 Node.js 22.x..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
  log "Node.js $(node --version) 安装完成"
fi

# ==============================================
# 2. 安装 MySQL
# ==============================================
info "检查 MySQL..."
if command -v mysql &>/dev/null; then
  log "MySQL 已安装: $(mysql --version 2>/dev/null || echo 'ok')"
else
  warn "正在安装 MySQL Server..."
  apt-get update
  apt-get install -y mysql-server
  systemctl start mysql
  systemctl enable mysql
  log "MySQL 安装完成"
fi

# ==============================================
# 3. 配置 MySQL 用户和数据库
# ==============================================
info "配置数据库..."

# Ubuntu 24.04 默认用 auth_socket，先切回密码认证
mysql -u root <<SQL 2>/dev/null || {
  warn "尝试用 sudo mysql 配置..."
  sudo mysql <<SQL
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'root123456';
FLUSH PRIVILEGES;
CREATE DATABASE IF NOT EXISTS ${MYSQL_DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${MYSQL_USER}'@'localhost' IDENTIFIED BY '${MYSQL_PASS}';
GRANT ALL PRIVILEGES ON ${MYSQL_DB}.* TO '${MYSQL_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
  log "数据库配置完成 (sudo)"
  exit_after_sql=true
}

if [ "$exit_after_sql" != "true" ]; then
  mysql -u root <<SQL 2>/dev/null
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'root123456';
FLUSH PRIVILEGES;
CREATE DATABASE IF NOT EXISTS ${MYSQL_DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${MYSQL_USER}'@'localhost' IDENTIFIED BY '${MYSQL_PASS}';
GRANT ALL PRIVILEGES ON ${MYSQL_DB}.* TO '${MYSQL_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
  log "数据库配置完成"
fi

# ==============================================
# 4. 确认项目文件在当前位置
# ==============================================
if [ ! -f "package.json" ]; then
  err "未找到 package.json，请在项目根目录运行此脚本"
fi
log "项目目录: $(pwd)"

# ==============================================
# 5. 安装依赖
# ==============================================
info "安装依赖..."
npm install --production=false
(cd client && npm install)
(cd server && npm install)
log "依赖安装完成"

# ==============================================
# 6. 构建
# ==============================================
info "构建项目..."
npm run build
log "构建完成"

# ==============================================
# 7. 数据库迁移 + 种子数据
# ==============================================
info "初始化数据库表和数据..."
cd server

# 检测是否首次部署
if npx prisma migrate status 2>/dev/null | grep -q "Database schema is up to date"; then
  log "数据库已是最新，跳过迁移"
else
  npx prisma migrate deploy 2>/dev/null || {
    warn "首次部署，创建初始迁移..."
    npx prisma migrate dev --name init
  }
  log "数据库迁移完成"
fi

# 种子数据（幂等）
npx prisma db seed 2>/dev/null || {
  warn "种子数据已有，跳过"
}
log "种子数据就绪"
cd ..

# ==============================================
# 8. 安装 PM2 并启动
# ==============================================
info "启动服务..."
npm install -g pm2 2>/dev/null || true

pm2 delete weblangrensha 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || pm2 startup 2>/dev/null || true

log "PM2 服务已启动"

# ==============================================
# 9. 完成
# ==============================================
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "你的服务器IP")

echo ""
echo "🐺==============================================🐺"
echo ""
echo -e "  ${GREEN}✅ 安装完成！${NC}"
echo ""
echo "  访问地址:  http://${SERVER_IP}:${APP_PORT}"
echo ""
echo "  管理命令:"
echo "    pm2 status            查看服务状态"
echo "    pm2 logs weblangrensha 查看实时日志"
echo "    pm2 reload weblangrensha 重启服务"
echo "    pm2 stop weblangrensha   停止服务"
echo ""
echo "  MySQL 信息:"
echo "    用户: ${MYSQL_USER}"
echo "    密码: ${MYSQL_PASS}"
echo "    数据库: ${MYSQL_DB}"
echo ""
echo "  如需配置 Nginx 反代:"
echo "    sudo apt install nginx -y"
echo "    然后配置 /etc/nginx/sites-available/weblangrensha"
echo ""
echo "🐺==============================================🐺"
echo ""
