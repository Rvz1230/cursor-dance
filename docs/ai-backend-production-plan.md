# CursorDance AI 后端生产部署计划

## 什么是 Vercel

Vercel 是用于部署前端应用和无服务器 API 端点的云平台。在本项目中，Vercel 可以托管：

- `dist/` 中的构建后的选项页/Popup 前端
- `api/**` 中的 API 函数
- DeepSeek API Key 等环境变量
- 浏览器扩展调用的 HTTPS 端点

对于 CursorDance，Vercel 不是 AI 模型服务商，而是扩展与 DeepSeek 之间的安全中间层。

```text
Chrome 扩展
  -> https://your-domain.com/api/ai/scheme-proposals
  -> Vercel Function
  -> DeepSeek
  -> schema 安全护栏
  -> 提案 JSON
```

## 推荐结构

首个生产版本将后端保留在当前项目中。

```text
api/
  health.js
  ai/
    scheme-proposals.js
server/
  ai/
    proposal-service.mjs
scripts/
  ai-api-server.mjs
```

这样可以保持扩展 UI、AI schema 安全护栏、本地服务器和生产 API 的版本一致。

## 生产环境变量

在 Vercel 项目设置中配置：

```bash
CURSORDANCE_AI_API_KEY=your_deepseek_key
CURSORDANCE_AI_API_BASE_URL=https://api.deepseek.com
CURSORDANCE_AI_API_MODE=chat_completions
CURSORDANCE_AI_MODEL=deepseek-chat
CURSORDANCE_ALLOWED_ORIGINS=chrome-extension://nckepaijkfcnnmmdllggalogfegpiepi,https://YOUR_PUBLIC_SITE
CURSORDANCE_AI_API_ACCESS_TOKEN=optional_shared_token
CURSORDANCE_AI_MAX_REQUEST_BYTES=51200
CURSORDANCE_AI_MAX_PROMPT_CHARS=1200
CURSORDANCE_AI_MAX_CURRENT_CONFIG_BYTES=24576
CURSORDANCE_AI_MAX_PROPOSAL_CONTEXT_BYTES=8192
CURSORDANCE_AI_MAX_OUTPUT_TOKENS=900
CURSORDANCE_AI_METRICS_LOG=1
```

构建扩展前端时设置：

```bash
VITE_CURSORDANCE_AI_API_ENDPOINT=https://YOUR_API_DOMAIN/api/ai/scheme-proposals
VITE_CURSORDANCE_AI_API_ACCESS_TOKEN=optional_shared_token
```

## 扩展清单

源文件 `public/manifest.json` 不应包含宽泛的远程主机权限。确定生产 API 域名后，构建并准备打包清单：

```bash
npm run build
CURSORDANCE_EXTENSION_HOST_PERMISSIONS=https://YOUR_API_DOMAIN/* npm run extension:prepare-manifest
```

也可以从 `VITE_CURSORDANCE_AI_API_ENDPOINT` 自动派生主机权限（当它是绝对 URL 时）：

```bash
VITE_CURSORDANCE_AI_API_ENDPOINT=https://YOUR_API_DOMAIN/api/ai/scheme-proposals npm run build
VITE_CURSORDANCE_AI_API_ENDPOINT=https://YOUR_API_DOMAIN/api/ai/scheme-proposals npm run extension:prepare-manifest
```

生成的 `dist/manifest.json` 应包含：

```json
{
  "host_permissions": [
    "https://YOUR_API_DOMAIN/*"
  ]
}
```

避免对 AI API 使用 `https://*/*` 等宽泛模式，扩展商店审核可能视为权限过大。

## 本地开发

```bash
npm run ai:dev
npm run dev
```

本地前端调用：

```text
/api/ai/scheme-proposals
```

Vite 将其代理到：

```text
http://localhost:8787/api/ai/scheme-proposals
```

## 部署清单

1. 从此仓库创建 Vercel 项目。
2. 添加生产环境变量。
3. 部署并验证 `GET /api/health`。
4. 用小型测试负载验证 `POST /api/ai/scheme-proposals`。
5. 用指向 Vercel API 的 `VITE_CURSORDANCE_AI_API_ENDPOINT` 构建扩展。
6. 运行 `npm run extension:prepare-manifest` 将精确 API 域名添加到 `host_permissions`。
7. 加载构建后的扩展并在本地测试 AI 提案生成。
8. 准备隐私政策和扩展商店数据使用披露。
9. 确认生产日志不包含完整的 `prompt`、`currentConfig`、模型提示或模型响应体。

## 生产验收标准

- DeepSeek Key 不出现在扩展包中。
- `/api/health` 返回 `modelProviderConfigured: true`。
- AI 提案来源为 `model-chat-completions`。
- 失败的模型调用返回可见错误，不静默降级为本地回退提案。
- 数值 `+1` 模式和其他核心意图在需要时由 schema 安全护栏修复。
- 请求体大小受限。
- 提示长度、配置大小、提案上下文大小和模型输出 token 数受限。
- 日志仅包含隐私安全的指标，不包含完整用户文本或配置。
- CORS 白名单已配置扩展 ID 和官方域名。
- Chrome Web Store 审核备忘、隐私政策草稿和支持页面草稿已就绪。
