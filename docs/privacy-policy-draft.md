# CursorDance Privacy Policy Draft

Last updated: 2026-05-20

CursorDance helps users customize cursor states and mouse feedback effects on webpages.

## Information Stored Locally

CursorDance stores configuration locally in Chrome extension storage, including selected themes, effect settings, per-site rules, and user-provided cursor or effect assets.

## AI Scheme Assistant

The AI scheme assistant is optional. When a user submits an AI request, CursorDance sends the user's prompt, current action config, task mode, schema version, extension version, and a slim pending proposal context to the CursorDance AI backend.

CursorDance does not send the full visible chat history. Clearing the AI conversation removes local AI panel messages and pending proposal context without changing applied settings.

The backend forwards the request to the configured AI model provider and returns a JSON proposal. The proposal is sanitized before display and is not applied unless the user confirms it.

## Logs

CursorDance backend logs must not contain full prompts, full configs, model prompts, raw model responses, or model provider API keys. Operational logs may include privacy-safe metrics such as request size, prompt length, task mode, status code, error code, duration, and dropped field count.

## Data Sharing

CursorDance does not sell user data. CursorDance does not use user data for advertising.

AI requests may be processed by the configured model provider solely to generate the requested CursorDance proposal.

## User Controls

Users can disable CursorDance, change or delete themes, remove uploaded assets, clear AI conversation state, and uninstall the extension at any time.

## Contact And Support

For support, use the support contact or support page listed in the Chrome Web Store listing.
