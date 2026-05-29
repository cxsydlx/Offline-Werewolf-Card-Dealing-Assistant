#!/bin/bash
# 部署脚本（无密码版，可推 GitHub）
# 用法: SSH_HOST=root@IP SSH_PASS=密码 bash deploy1.sh

set -e

HOST="${SSH_HOST:?请设置 SSH_HOST，例如: SSH_HOST=root@60.205.92.184}"
PASS="${SSH_PASS:?请设置 SSH_PASS}"
REMOTE="/opt/weblangrensha"

echo "🔨 构建前端..."
cd client && npm run build && cd ..

echo "🔨 构建后端..."
cd server && npm run build && cd ..

echo "📦 打包..."
tar -czf /tmp/w.tar.gz client/dist/ server/dist/ server/prisma/ server/package.json

echo "📤 上传..."
sshpass -p "$PASS" scp /tmp/w.tar.gz "$HOST:/tmp/w.tar.gz"

echo "🚀 部署..."
sshpass -p "$PASS" ssh "$HOST" "
  cd $REMOTE
  tar -xzf /tmp/w.tar.gz
  rm /tmp/w.tar.gz
  npx prisma generate
  npx prisma db push
  pm2 restart weblangrensha
"

echo "✅ 部署完成"
