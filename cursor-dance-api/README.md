# CursorDance AI API

CursorDance Chrome 扩展的 AI 方案助手后端服务。接收前端的中文描述，调用 DeepSeek API 生成结构化的鼠标反馈配置方案，经过安全清洗管道后返回可执行的配置补丁。

## 架构

```
浏览器扩展（AiSchemePanel）
    │ POST /api/ai/scheme-proposals/stream
    ▼
阿里云 FC / 本地 Node Server
    │ POST https://api.deepseek.com/v1/chat/completions
    ▼
DeepSeek API (deepseek-chat)
    │ JSON response
    ▼
安全清洗管道 → SSE 推送回浏览器
```

## 本地开发

```bash
# 1. 配置环境变量
cp deploy/aliyun-fc/.env.example .env.local
# 编辑 .env.local，填入 DEEPSEEK_API_KEY

# 2. 启动开发服务器
npm run dev        # 默认 http://127.0.0.1:8787

# 3. 冒烟测试
npm run check
```

## 生产部署

部署到阿里云函数计算 FC：

```bash
# 使用 Serverless Devs 工具
s deploy
```

部署后配置自定义域名（如 `ai.cursordance.cn`），然后在扩展构建环境变量中设置：

```
VITE_CURSORDANCE_AI_API_ENDPOINT=https://ai.cursordance.cn/api/ai/scheme-proposals
```

## 安全清洗管道

```
AI 原始 JSON 输出
  → safeJsonParse（容错解析）
  → sanitizeAiSchemePatch（白名单过滤 + 数值钳位 + 枚举校验 + 类型校验）
  → repairPatchForUserIntent（30+ 中文意图规则注册表）
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
├── proposal-service.mjs   # 鉴权/限流/编排（仅后端）
├── server.mjs             # HTTP Server（仅后端）
└── index.mjs              # 统一导出
```

## 环境变量

| 变量 | 用途 | 默认值 |
|------|------|--------|
| `CURSORDANCE_AI_API_KEY` | DeepSeek API Key | 无（必填） |
| `OPENAI_API_KEY` | 兼容 OpenAI 的 Key | 无 |
| `CURSORDANCE_AI_API_BASE_URL` | API 基础地址 | `https://api.deepseek.com/v1` |
| `CURSORDANCE_AI_MODEL` | 模型名称 | `deepseek-chat` |
| `CURSORDANCE_AI_API_MODE` | 固定 `chat_completions` | `chat_completions` |
| `CURSORDANCE_AI_API_ACCESS_TOKEN` | 访问鉴权 Token | 无 |
| `CURSORDANCE_AI_API_PORT` | 本地端口 | `8787` |
| `CURSORDANCE_AI_API_HOST` | 本地地址 | `127.0.0.1` |
| `CURSORDANCE_ALLOWED_ORIGINS` | CORS 白名单 | `localhost:5173` |
| `CURSORDANCE_AI_METRICS_LOG` | 指标日志开关（0=关闭） | 开启 |
