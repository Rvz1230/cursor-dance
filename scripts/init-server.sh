#!/bin/bash
# CursorDance AI API — 服务器初始化脚本
#
# 用法（在本地执行，通过 SSH 远程初始化）：
#   ssh root@112.124.1.117 'bash -s' < scripts/init-server.sh
#
# 支持：Ubuntu/Debian (apt) · CentOS/Anolis/Alibaba Cloud Linux (dnf/yum)

set -euo pipefail

# 检测系统包管理器
if command -v apt &>/dev/null; then
  PKG_MGR="apt"
elif command -v dnf &>/dev/null; then
  PKG_MGR="dnf"
elif command -v yum &>/dev/null; then
  PKG_MGR="yum"
else
  echo "错误：未找到 apt/dnf/yum，不支持当前系统。"
  exit 1
fi

echo "==> 检测到包管理器: ${PKG_MGR}"

echo "==> 安装 Node.js 22.x..."
if command -v node &>/dev/null; then
  echo "Node.js 已安装: $(node -v)"
else
  case "$PKG_MGR" in
    apt)
      curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
      apt install -y nodejs
      ;;
    dnf|yum)
      curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
      "$PKG_MGR" install -y nodejs
      ;;
  esac
  echo "Node.js 安装完成: $(node -v)"
fi

echo "==> 安装 pm2..."
if command -v pm2 &>/dev/null; then
  echo "pm2 已安装: $(pm2 -v)"
else
  npm install -g pm2
  echo "pm2 安装完成"
fi

echo "==> 创建目录..."
mkdir -p /var/log/cursor-dance-api
mkdir -p /opt/cursor-dance-api

echo "==> 配置 pm2 开机自启..."
pm2 startup systemd -u root --hp /root 2>/dev/null || true

echo "==> 开放 8787 端口..."
# firewalld（RHEL 系默认）
if command -v firewall-cmd &>/dev/null && systemctl is-active --quiet firewalld 2>/dev/null; then
  firewall-cmd --permanent --add-port=8787/tcp 2>/dev/null || true
  firewall-cmd --reload 2>/dev/null || true
  echo "firewalld: 8787/tcp 已放行"
fi

# ufw（Ubuntu 默认）
if command -v ufw &>/dev/null; then
  ufw allow 8787/tcp 2>/dev/null || true
  echo "ufw: 8787/tcp 已放行"
fi

echo ""
echo "==> 服务器初始化完成 =="
echo "    OS:      $(. /etc/os-release 2>/dev/null && echo "$NAME" || uname -s)"
echo "    Node.js: $(node -v)"
echo "    npm:     $(npm -v)"
echo "    pm2:     $(pm2 -v)"
echo ""
echo "==> 接下来你需要在阿里云控制台操作 =="
echo "  1. ECS 控制台 → 安全组 → 入方向 → 添加规则 → 端口 8787/tcp"
echo "  2. 宝塔面板 → 安全 → 防火墙 → 放行端口 → 8787"
echo ""
echo "==> 然后回到本地 Mac 终端 =="
echo "  3. 配置 .env.local（见下方命令）"
echo "  4. CURSORDANCE_HOST=112.124.1.117 ./scripts/deploy-api.sh"
echo ""
echo "  # 配置 API Key（SSH 到服务器后执行）："
echo "  cat > /opt/cursor-dance-api/.env.local << 'EOF'"
echo "  CURSORDANCE_AI_API_KEY=sk-你的deepseek密钥"
echo "  CURSORDANCE_AI_API_ACCESS_TOKEN=随便设一个随机字符串"
echo "  CURSORDANCE_ALLOWED_ORIGINS=*"
echo "  EOF"
