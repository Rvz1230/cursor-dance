# CursorDance AI Backend Production Plan

## What Vercel Is

Vercel is a cloud platform for deploying frontend apps and serverless API endpoints. In this project, Vercel can host:

- the built options/popup frontend from `dist`
- API functions from `api/**`
- environment variables such as the DeepSeek API key
- HTTPS endpoints for the browser extension to call

For CursorDance, Vercel is not the AI model provider. It is the secure middle layer between the extension and DeepSeek.

```text
Chrome Extension
  -> https://your-domain.com/api/ai/scheme-proposals
  -> Vercel Function
  -> DeepSeek
  -> schema guardrails
  -> proposal JSON
```

## Recommended Shape

Keep the backend inside the current project for the first production version.

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

This keeps the extension UI, AI schema guardrails, local server, and production API versioned together.

## Production Environment Variables

Set these in Vercel Project Settings:

```bash
CURSORDANCE_AI_API_KEY=your_deepseek_key
CURSORDANCE_AI_API_BASE_URL=https://api.deepseek.com
CURSORDANCE_AI_API_MODE=chat_completions
CURSORDANCE_AI_MODEL=deepseek-chat
CURSORDANCE_ALLOWED_ORIGINS=chrome-extension://YOUR_EXTENSION_ID,https://YOUR_PUBLIC_SITE
CURSORDANCE_AI_API_ACCESS_TOKEN=optional_shared_token
CURSORDANCE_AI_MAX_REQUEST_BYTES=51200
CURSORDANCE_AI_MAX_PROMPT_CHARS=1200
CURSORDANCE_AI_MAX_CURRENT_CONFIG_BYTES=24576
CURSORDANCE_AI_MAX_PROPOSAL_CONTEXT_BYTES=8192
CURSORDANCE_AI_MAX_OUTPUT_TOKENS=900
CURSORDANCE_AI_METRICS_LOG=1
```

Set this when building the extension frontend:

```bash
VITE_CURSORDANCE_AI_API_ENDPOINT=https://YOUR_API_DOMAIN/api/ai/scheme-proposals
VITE_CURSORDANCE_AI_API_ACCESS_TOKEN=optional_shared_token
```

## Extension Manifest

Source `public/manifest.json` should not contain broad remote host permissions. Once the production API domain is known, build and prepare the packaged manifest:

```bash
npm run build
CURSORDANCE_EXTENSION_HOST_PERMISSIONS=https://YOUR_API_DOMAIN/* npm run extension:prepare-manifest
```

Alternatively, the script can derive the host permission from `VITE_CURSORDANCE_AI_API_ENDPOINT` when it is an absolute URL:

```bash
VITE_CURSORDANCE_AI_API_ENDPOINT=https://YOUR_API_DOMAIN/api/ai/scheme-proposals npm run build
VITE_CURSORDANCE_AI_API_ENDPOINT=https://YOUR_API_DOMAIN/api/ai/scheme-proposals npm run extension:prepare-manifest
```

The resulting `dist/manifest.json` should contain:

```json
{
  "host_permissions": [
    "https://YOUR_API_DOMAIN/*"
  ]
}
```

Avoid broad patterns such as `https://*/*` for the AI API because extension store review may treat them as excessive.

## Local Development

```bash
npm run ai:dev
npm run dev
```

Local frontend calls:

```text
/api/ai/scheme-proposals
```

Vite proxies this to:

```text
http://localhost:8787/api/ai/scheme-proposals
```

## Deployment Checklist

1. Create a Vercel project from this repository.
2. Add the production environment variables.
3. Deploy and verify `GET /api/health`.
4. Verify `POST /api/ai/scheme-proposals` with a small test payload.
5. Build the extension with `VITE_CURSORDANCE_AI_API_ENDPOINT` pointing to the Vercel API.
6. Run `npm run extension:prepare-manifest` to add the exact API domain to `host_permissions`.
7. Load the built extension locally and test AI proposal generation.
8. Prepare privacy policy and extension store data-use disclosures.
9. Confirm production logs do not contain full `prompt`, `currentConfig`, model prompt, or model response bodies.

## Production Acceptance Criteria

- DeepSeek key never appears in the extension bundle.
- `/api/health` returns `modelProviderConfigured: true`.
- AI proposal source is `model-chat-completions`.
- Failed model calls return visible errors instead of local fallback proposals.
- Numeric `+1` mode and other core intents are repaired by schema guardrails when needed.
- Request body size is limited.
- Prompt length, config size, proposal context size, and model output tokens are limited.
- Logs contain only privacy-safe metrics and never full user text or configs.
- CORS allowlist is configured for the extension ID and official domains.
- Chrome Web Store review notes, privacy policy draft, and support page draft are ready.
