# CursorDance AI API

CursorDance Chrome 扩展的 AI 方案助手后端服务。接收前端的中文描述，调用 DeepSeek API 生成结构化的鼠标反馈配置方案，经过安全清洗管道后返回可执行的配置补丁。

## 架构

```
浏览器扩展（AiSchemePanel）
    │ POST /api/ai/scheme-proposals/stream
    ▼
阿里云 FC（统一 HTTP 函数）
    │ POST https://api.deepseek.com/v1/chat/completions
    ▼
DeepSeek API (deepseek-v4-flash)
    │ JSON response
    ▼
安全清洗管道 → SSE 推送回浏览器
```

## 本地开发

```bash
# 1. 配置环境变量
cp .env.example .env.local   # 或手动创建 .env.local
# 编辑 .env.local，填入 CURSORDANCE_AI_API_KEY

# 2. 启动开发服务器
npm run dev        # 默认 http://127.0.0.1:8787

# 3. 冒烟测试
npm run check
```

## 生产部署（阿里云 FC）

### 首次部署

```bash
# 1. 设置环境变量
export CURSORDANCE_AI_API_KEY=sk-your-deepseek-key
export CURSORDANCE_AI_API_ACCESS_TOKEN=your-random-token

# 2. 部署
cd cursor-dance-api
s deploy
```

部署成功后会输出函数域名，格式类似：
```
https://cursor-dance-api-<uid>.cn-hangzhou.fcapp.run
```

### 连接扩展

将域名填入项目根目录 `.env.production`：

```
VITE_CURSORDANCE_AI_API_ENDPOINT=https://<你的域名>/api/ai/scheme-proposals
VITE_CURSORDANCE_AI_API_ACCESS_TOKEN=<与 FC 环境变量一致的 token>
```

然后构建扩展：

```bash
npm run build && npm run extension:prepare-manifest
```

生成的 `dist/` 目录可以直接加载为 Chrome 扩展。

## 安全清洗管道

```
AI 原始 JSON 输出
  → safeJsonParse（容错解析）
  → sanitizeAiSchemePatch（白名单过滤 + 数值钳位 + 枚举校验 + 类型校验）
  → repairPatchForUserIntent（19 条中文意图规则注册表）
  → normalizeAiSchemeProposal（标准化为 proposal 对象）
  → 返回浏览器 → 用户预览 → 确认后应用
```

## 模块结构

```
src/
├── field-defs.js          # 共享 schema 常量（前后端通用）
├── sanitize.js            # 字段清洗（前后端通用）
├── errors.js              # 错误消息（前后端通用）
├── intent-repair.js       # 中文意图修复规则注册表（前后端通用）
├── diff.js                # Diff 计算（前后端通用）
├── normalize.js           # Proposal 标准化（前后端通用）
├── client.js              # 浏览器 HTTP 客户端（仅前端）
├── model-provider.mjs     # DeepSeek API 调用（仅后端）
├── proposal-service.mjs   # 鉴权/限流/CORS/编排（仅后端）
├── server.mjs             # HTTP Server（仅后端）
└── index.mjs              # 统一导出

index.mjs                  # FC3 入口（统一 HTTP 函数）
s.yaml                     # Serverless Devs 部署配置
```

## 限流策略

上线 Chrome Web Store 后，为防止 API 被滥用导致费用超支，后端内置三层内存限流（pm2 单进程适用）：

| 层级 | 维度 | 默认值 | 说明 |
|------|------|--------|------|
| **并发限制** | 全局 | quick 模式 3，agent 模式 1 | 同时处理中的请求数上限，超出返回 `503` |
| **IP 频率限制** | 按 IP 滑动窗口 | quick: 3 次/分 + 20 次/时；agent: 1 次/分 + 5 次/时 | 超出返回 `429` + `retryAfter` |
| **日预算上限** | 全局计数器 | 1000 次/天（可配，0=不限制） | 超出返回 `429`，换日自动重置 |

限制值均通过环境变量配置（见下方 `CURSORDANCE_AI_RATE_LIMIT_ENABLED` 等），可在 `.env.production` 中按需调整。日预算写入文件持久化，pm2 重启不丢失。

## 环境变量

| 变量 | 用途 | 默认值 |
|------|------|--------|
| `CURSORDANCE_AI_API_KEY` | DeepSeek API Key | 无（必填） |
| `CURSORDANCE_AI_API_BASE_URL` | API 基础地址 | `https://api.deepseek.com/v1` |
| `CURSORDANCE_AI_MODEL` | 模型名称 | `deepseek-v4-flash` |
| `CURSORDANCE_AI_API_MODE` | 固定 `chat_completions` | `chat_completions` |
| `CURSORDANCE_AI_API_ACCESS_TOKEN` | 访问鉴权 Token | 无（建议设置） |
| `CURSORDANCE_AI_API_PORT` | 本地端口 | `8787` |
| `CURSORDANCE_AI_API_HOST` | 本地地址 | `127.0.0.1` |
| `CURSORDANCE_ALLOWED_ORIGINS` | CORS 白名单（生产用 `*`） | `localhost:5173` |
| `CURSORDANCE_AI_METRICS_LOG` | 指标日志开关（0=关闭） | 开启 |
| `CURSORDANCE_AI_RATE_LIMIT_ENABLED` | 限流总开关 | `1`（开启） |
| `CURSORDANCE_AI_MAX_CONCURRENCY` | 最大并发 AI 请求（quick 模式） | `3` |
| `CURSORDANCE_AI_MAX_CONCURRENCY_AGENT` | 最大并发 AI 请求（agent 模式） | `1` |
| `CURSORDANCE_AI_RPM_IP` | 每 IP 每分钟请求数（quick） | `3` |
| `CURSORDANCE_AI_RPH_IP` | 每 IP 每小时请求数（quick） | `20` |
| `CURSORDANCE_AI_RPM_IP_AGENT` | 每 IP 每分钟请求数（agent） | `1` |
| `CURSORDANCE_AI_RPH_IP_AGENT` | 每 IP 每小时请求数（agent） | `5` |
| `CURSORDANCE_AI_DAILY_REQUEST_BUDGET` | 日请求硬上限（0=不限制） | `1000` |
| `CURSORDANCE_AI_BUDGET_FILE` | 日预算持久化文件路径 | 空（不持久化） |
