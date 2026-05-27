#!/bin/bash
# CursorDance AI API — 部署到阿里云 ECS
#
# 前置条件：
#   1. 服务器已安装 Node.js 22+ 和 pm2
#   2. SSH 免密登录已配置（或使用密码）
#   3. 服务器安全组已开放 8787 端口
#
# 使用：
#   CURSORDANCE_HOST=112.124.1.117 ./scripts/deploy-api.sh
#   CURSORDANCE_HOST=112.124.1.117 CURSORDANCE_SSH_USER=root ./scripts/deploy-api.sh
#
# 首次部署前，先在服务器上执行一次初始化：
#   ssh root@112.124.1.117 'bash -s' < scripts/init-server.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
API_DIR="$ROOT_DIR/cursor-dance-api"

HOST="${CURSORDANCE_HOST:?请设置 CURSORDANCE_HOST 环境变量，例如 CURSORDANCE_HOST=112.124.1.117}"
SSH_USER="${CURSORDANCE_SSH_USER:-root}"
REMOTE_DIR="${CURSORDANCE_REMOTE_DIR:-/opt/cursor-dance-api}"
PORT="${CURSORDANCE_API_PORT:-8787}"

echo "==> 同步代码到 ${SSH_USER}@${HOST}:${REMOTE_DIR} ..."
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='tests' \
  --exclude='README.md' \
  --exclude='s.yaml' \
  --exclude='.env.example' \
  --exclude='.git' \
  "$API_DIR/" "${SSH_USER}@${HOST}:${REMOTE_DIR}/"

echo "==> 安装依赖..."
ssh "${SSH_USER}@${HOST}" "cd ${REMOTE_DIR} && npm install --production"

echo "==> 重启 API 服务..."
ssh "${SSH_USER}@${HOST}" "cd ${REMOTE_DIR} && pm2 reload ecosystem.config.cjs || pm2 start ecosystem.config.cjs"
ssh "${SSH_USER}@${HOST}" "pm2 save"

echo "==> 健康检查..."
sleep 2
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://${HOST}:${PORT}/api/health" || echo "000")

if [ "$HEALTH" = "200" ]; then
  echo "==> 部署成功 健康检查通过 (HTTP $HEALTH)"
  echo "    API 地址: http://${HOST}:${PORT}/api/health"
else
  echo "==> 警告：健康检查返回 HTTP $HEALTH，请检查服务器日志"
  echo "    ssh ${SSH_USER}@${HOST} 'pm2 logs cursor-dance-api --lines 20'"
fi
