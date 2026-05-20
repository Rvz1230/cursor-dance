# CursorDance Chrome Web Store Review Notes

## Single Purpose

CursorDance customizes cursor states and mouse feedback effects on webpages. Users can configure click text, particles, ripples, optional sound, cursor images, and AI-assisted proposal drafts from the options page.

## Permission Justification

### `storage`

Stores the user's CursorDance configuration, selected theme, per-site settings, and uploaded cursor assets locally in Chrome extension storage.

### `activeTab`

Used when the user previews a theme from the popup or workbench. CursorDance sends a preview message only to the current active tab so the user can see the effect before saving.

### `unlimitedStorage`

Used for user-provided cursor images and effect assets. CursorDance stores these assets locally as data URLs and caps individual cursor image data URLs in code. This permission avoids Chrome local storage quota failures for users who create multiple themes.

### Content Script Matches

CursorDance runs on `http://*/*` and `https://*/*` because its core feature is webpage cursor and pointer feedback. The content script does not read page text for AI prompts and does not send browsing history to the AI backend.

### `host_permissions`

Source `public/manifest.json` does not include broad remote host permissions. For packaged extension builds, run:

```bash
npm run build
CURSORDANCE_EXTENSION_HOST_PERMISSIONS=https://YOUR_API_DOMAIN/* npm run extension:prepare-manifest
```

The script writes exact API origins into `dist/manifest.json`. It rejects broad wildcard host patterns.

## AI Data Disclosure

CursorDance includes an optional AI scheme assistant. When the user submits an AI request, CursorDance sends:

- prompt text entered by the user
- current action config
- slim pending proposal context, if present
- task mode
- extension version
- schema version

CursorDance does not send full visible chat history. The backend must not log full prompts, configs, model prompts, or raw model responses. It logs only privacy-safe operational metrics such as byte sizes, status codes, duration, mode, and dropped field counts.

The AI proposal is not applied automatically. The model output is sanitized against an allowlist, shown to the user, and only applied after confirmation.

## Remote Code Statement

CursorDance does not execute remote code in the extension. AI responses are treated as JSON data proposals. Returned fields are sanitized and clamped before use.

## Data Sale And Ads

CursorDance does not sell user data and does not use user data for advertising.

## Store Checklist

- Build with production `VITE_CURSORDANCE_AI_API_ENDPOINT`.
- Run `npm run extension:prepare-manifest` with the exact API host permission.
- Confirm `dist/manifest.json` has no `https://*/*` or `<all_urls>` host permission.
- Confirm `dist/manifest.json` still only uses `storage`, `activeTab`, and `unlimitedStorage`.
- Confirm privacy policy and support URL are published.
- Confirm AI backend logs do not include full prompt or config bodies.
