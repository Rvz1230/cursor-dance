# CursorDance AI API Local Setup

CursorDance uses a small local AI API server during development. The workbench calls `/api/ai/modify-scheme`; Vite proxies that path to the local server.

## Start Local Prototype

```bash
npm run ai:dev
npm run dev
```

The AI assistant requires a configured model provider. Without a model API key, the server returns `503` instead of generating a local placeholder response.

The request body is intentionally narrow: `prompt`, `currentConfig`, slim `proposalContext`, `taskMode`, `extensionVersion`, and `schemaVersion`. The frontend does not send the full visible chat history.

## Use OpenAI Responses API

```bash
export OPENAI_API_KEY="your_api_key"
export CURSORDANCE_AI_API_MODE="responses"
export CURSORDANCE_AI_MODEL="gpt-4.1-mini"
npm run ai:dev
```

## Use OpenAI-Compatible Chat Completions

Use this mode for providers that expose an OpenAI-compatible `/chat/completions` endpoint.

```bash
export CURSORDANCE_AI_API_KEY="your_provider_key"
export CURSORDANCE_AI_API_BASE_URL="https://api.deepseek.com"
export CURSORDANCE_AI_API_MODE="chat_completions"
export CURSORDANCE_AI_MODEL="deepseek-chat"
npm run ai:dev
```

## Production Readiness Boundary

The model never writes directly to the workbench config. Its output is parsed as JSON, reduced to a whitelisted patch, sanitized by field type, clamped by numeric ranges, then presented as a proposal. The frontend only writes the patch after the user previews or confirms it.

The assistant is considered connected only when the proposal source is `model-chat-completions` or `model-responses-api`. API failures must stay visible to the user and must not silently fall back to deterministic local rules.

## Privacy And Cost Controls

The backend must not log full user prompts, full configs, model prompts, or model responses. Metrics logs contain only counts and operational fields: mode, versions, prompt length, config/context byte sizes, raw body bytes, target count, dropped field count, duration, status, and error code. Disable metrics logs with:

```bash
export CURSORDANCE_AI_METRICS_LOG=0
```

Configurable request limits:

```bash
export CURSORDANCE_AI_MAX_REQUEST_BYTES=51200
export CURSORDANCE_AI_MAX_PROMPT_CHARS=1200
export CURSORDANCE_AI_MAX_CURRENT_CONFIG_BYTES=24576
export CURSORDANCE_AI_MAX_PROPOSAL_CONTEXT_BYTES=8192
export CURSORDANCE_AI_MAX_OUTPUT_TOKENS=900
```

For shared-token protection, set the same token in the backend and extension build environment:

```bash
export CURSORDANCE_AI_API_ACCESS_TOKEN="server_token"
export VITE_CURSORDANCE_AI_API_ACCESS_TOKEN="server_token"
```

Required response shape:

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
