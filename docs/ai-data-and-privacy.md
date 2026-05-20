# CursorDance AI Data And Privacy Notes

## Data Flow

When the AI scheme assistant is used, the extension sends a single proposal request to the CursorDance AI backend:

- user prompt text
- current action config
- slim proposal context for the pending AI proposal, if any
- task mode
- extension version
- schema version

The frontend does not send the full visible chat history. Clearing the AI conversation removes the local panel messages and pending proposal context without changing already applied configuration.

The backend forwards the request to the configured model provider, such as DeepSeek or the OpenAI Responses API, and receives a JSON proposal. CursorDance sanitizes the proposal against an allowlist of config fields before showing it to the user.

## What Is Not Stored

CursorDance backend code must not persist or log:

- full user prompt text
- full `currentConfig`
- full `proposalContext`
- model prompt bodies
- raw model responses
- model provider API keys

## Operational Metrics

The backend may log privacy-safe metrics for reliability and cost monitoring:

- task mode
- schema and extension versions
- prompt character count
- current config byte size
- proposal context byte size
- raw request byte size
- response status and error code
- duration
- target count
- dropped field count

These logs are controlled by `CURSORDANCE_AI_METRICS_LOG`. Set it to `0` to disable metrics logs.

## User Control

AI proposals are not applied automatically. The model output is sanitized, previewed, and only written after the user applies the proposal.

The user can clear the AI conversation at any time. This clears local conversation state and pending AI proposal context, while preserving applied CursorDance configuration.

## Cost And Abuse Controls

The backend enforces configurable limits:

- `CURSORDANCE_AI_MAX_REQUEST_BYTES`
- `CURSORDANCE_AI_MAX_PROMPT_CHARS`
- `CURSORDANCE_AI_MAX_CURRENT_CONFIG_BYTES`
- `CURSORDANCE_AI_MAX_PROPOSAL_CONTEXT_BYTES`
- `CURSORDANCE_AI_MAX_OUTPUT_TOKENS`

The backend can require a shared access token with `CURSORDANCE_AI_API_ACCESS_TOKEN`. Production extension builds should pass the matching `VITE_CURSORDANCE_AI_API_ACCESS_TOKEN`.
