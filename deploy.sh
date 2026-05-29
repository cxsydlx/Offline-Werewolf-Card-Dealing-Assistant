#!/bin/bash
set -e

echo "🐺 狼人杀·熟人局助手 — 部署脚本"
echo "=================================="

# 检查 Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js 未安装，请先安装 Node.js 20+"
  exit 1
fi
echo "✅ Node.js $(node --version)"

# 检查 MySQL
if ! command -v mysql &> /dev/null; then
  echo "❌ MySQL 未安装，请先安装 MySQL"
  exit 1
fi
echo "✅ MySQL $(mysql --version 2>/dev/null | head -1)"

# 创建数据库（如果不存在）
echo ""
echo "📦 创建数据库..."
mysql -u werewolf -p'biB8mGZr5DdpN7ZD' -e "CREATE DATABASE IF NOT EXISTS weblangrensha CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || {
  echo "⚠️  无法连接 MySQL，请检查用户名密码，或手动建库后重试"
  echo "   mysql -u werewolf -p -e \"CREATE DATABASE IF NOT EXISTS weblangrensha CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\""
}

# 安装依赖
echo ""
echo "📦 安装依赖..."
npm install --production=false
cd client && npm install && cd ..
cd server && npm install && cd ..

# 构建
echo ""
echo "🔨 构建..."
npm run build

# 数据库迁移
echo ""
echo "🗄️ 数据库迁移..."
cd server
npx prisma migrate deploy 2>/dev/null || {
  echo "⚠️  首次部署，使用 migrate dev 初始化"
  npx prisma migrate dev --name init
}
npx prisma db seed
cd ..

# 启动/重启服务
echo ""
echo "🚀 启动服务..."

if command -v pm2 &> /dev/null; then
  pm2 delete weblangrensha 2>/dev/null || true
  pm2 start ecosystem.config.cjs
  pm2 save
  echo "✅ PM2 已启动，查看状态: pm2 status"
else
  echo "PM2 未安装，使用 nohup 启动"
  npm install -g pm2
  pm2 start ecosystem.config.cjs
  pm2 save
fi

echo ""
echo "==========================================="
echo "✅ 部署完成！"
echo "   访问地址: http://$(hostname -I | awk '{print $1}'):3001"
echo "   查看日志: pm2 logs weblangrensha"
echo "   重启服务: pm2 reload weblangrensha"
echo "==========================================="
