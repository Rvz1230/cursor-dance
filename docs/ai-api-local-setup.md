# CursorDance AI API 本地搭建

CursorDance 在开发阶段使用一个小型本地 AI API 服务器。工作台通过 Vite 代理将 `/api/ai/scheme-proposals/stream` 请求转发至本地服务器。

## 启动本地开发

```bash
npm run ai:dev
npm run dev
```

AI 助手需要配置模型服务商。未配置 API Key 时，服务器返回 `503` 而非生成本地占位响应。

请求体设计精简：仅包含 `prompt`、`currentConfig`、精简的 `proposalContext`、`taskMode`、`extensionVersion` 和 `schemaVersion`。前端不会发送完整的可见聊天历史。

## 使用 OpenAI Responses API

```bash
export OPENAI_API_KEY="your_api_key"
export CURSORDANCE_AI_API_MODE="responses"
export CURSORDANCE_AI_MODEL="gpt-4.1-mini"
npm run ai:dev
```

## 使用 OpenAI 兼容的 Chat Completions

适用于暴露 OpenAI 兼容 `/chat/completions` 端点的服务商。

```bash
export CURSORDANCE_AI_API_KEY="your_provider_key"
export CURSORDANCE_AI_API_BASE_URL="https://api.deepseek.com"
export CURSORDANCE_AI_API_MODE="chat_completions"
export CURSORDANCE_AI_MODEL="deepseek-v4-flash"
npm run ai:dev
```

## 生产就绪边界

模型永远不能直接写入工作台配置。其输出经过 JSON 解析 → 白名单字段过滤 → 按字段类型清洗 → 按数值范围钳位 → 以提案形式展示给用户。前端仅在用户预览并确认后才写入补丁。

AI 助手仅在提案来源为 `model-chat-completions` 或 `model-responses-api` 时视为已连接。API 调用失败必须向用户显示可见错误，不能静默降级为确定性本地规则。

## 隐私与成本控制

后端不得记录完整的用户提示、完整配置、模型提示或模型响应。指标日志仅包含计数和运维字段：模式、版本号、提示长度、配置/上下文字节大小、原始请求体大小、目标数量、丢弃字段数、耗时、状态码和错误码。关闭指标日志：

```bash
export CURSORDANCE_AI_METRICS_LOG=0
```

可配置的请求限制：

```bash
export CURSORDANCE_AI_MAX_REQUEST_BYTES=51200
export CURSORDANCE_AI_MAX_PROMPT_CHARS=1200
export CURSORDANCE_AI_MAX_CURRENT_CONFIG_BYTES=24576
export CURSORDANCE_AI_MAX_PROPOSAL_CONTEXT_BYTES=8192
export CURSORDANCE_AI_MAX_OUTPUT_TOKENS=900
```

共享 Token 保护（后端和扩展构建需设置相同的值）：

```bash
export CURSORDANCE_AI_API_ACCESS_TOKEN="server_token"
export VITE_CURSORDANCE_AI_API_ACCESS_TOKEN="server_token"
```

要求的响应格式：

```json
{
  "mode": "modify_action",
  "scheme": {
    "name": "低干扰蓝色方案",
    "summary": "适合写代码的轻量鼠标反馈。",
    "styleTags": ["低调", "科技感", "无音效"],
    "rationale": "用冷色、少量粒子和轻波纹保留反馈，同时关闭声音和强震动。"
  },
  "targets": [
    {
      "type": "action",
      "actionId": "leftClick",
      "label": "左键单击",
      "patch": {
        "textColor": "#0284C7",
        "sound": false,
        "volume": 0
      }
    }
  ],
  "reply": "我已生成一版低干扰蓝色点击方案。",
  "diffSummary": ["关闭音效", "主色调整为 #0284C7"],
  "riskLevel": "low",
  "warnings": [],
  "tuningOptions": ["更低调", "更明显", "减少粒子"]
}
```
