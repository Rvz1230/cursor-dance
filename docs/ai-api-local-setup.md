# CursorDance AI API Local Setup

CursorDance uses a small local AI API server during development. The workbench calls `/api/ai/modify-scheme`; Vite proxies that path to the local server.

## Start Local Prototype

```bash
npm run ai:dev
npm run dev
```

Without a model API key, the server uses the built-in local prototype generator.

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

## Safety Boundary

The model never writes directly to the workbench config. Its output is parsed as JSON, reduced to a whitelisted patch, sanitized by field type, clamped by numeric ranges, then applied by the frontend.

Required response shape:

```json
{
  "reply": "我已生成一版低干扰蓝色点击效果。",
  "patch": {
    "textColor": "#0284C7",
    "sound": false,
    "volume": 0
  },
  "diffSummary": ["关闭音效", "主色调整为 #0284C7"]
}
```
