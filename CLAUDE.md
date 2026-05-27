# CLAUDE.md

## Overview
CursorDance is a Chrome extension (Manifest V3) that adds customizable mouse interaction effects to web pages. Users edit themes in a React Workbench (options page), pick active themes in a popup, and effects render via content scripts on all pages.

## Commands
```
npm run dev           # Vite dev server (workbench + popup)
npm run build         # Production build → dist/
npm run test          # Vitest unit tests (51 tests)
npm run test:smoke    # Playwright E2E smoke tests
npm run ai:dev        # AI API server (scripts/ai-api-server.mjs)
```

## Architecture

### Three entrypoints
- `index.html` + `main.jsx` → **Workbench** (extension options page, full React app)
- `popup.html` + `popup-main.jsx` → **Popup** (toolbar popup, 360×540px fixed)
  - Reads global config and live preview config, resolves active theme respecting per-site rules
  - Popup theme switches update site rule if one exists for current host, otherwise update global active theme
- `public/content.js` → **Content script runtime** (injected into every page)

### Content script module system
Content scripts can't use ES modules, so `public/` uses IIFE registration via `window.CursorDanceContentModules`. Load order (defined in `manifest.json`):
```
text-semantics.js → action-config.js → config.js
→ diagnostics.js → config-store.js → visual-effects.js
→ audio-duck-profile.js → audio.js → cursor-overlay.js
→ trigger-handlers.js → content.js
```
`content.js` is the DI container — it creates each module passing a `runtime` object with only the dependencies that module needs.

### Workbench component tree
```
ThemeWorkbenchPage
├── WorkbenchHeader          # Workspace switcher, save, enable toggle
├── ThemeLibrarySidebar      # Create/duplicate/delete/import/export themes
└── main (by workspaceId)
    ├── workbench            # Action config + preview + optional AI panel
    ├── states (StatesPanel) # Cursor state management (6 states)
    ├── sites (SitesPanel)   # Per-host site rules
    └── diagnostics          # Diagnostic event viewer
```

### State management
- `themeWorkbenchStateStore.js` — `useReducer` with 20 action types
- `useThemeWorkbenchState.js` — Main hook exposing all state + actions
- `useThemeWorkbenchPersistence.js` — Hydrates from `chrome.storage.local`, syncs unsaved flag
- Key: `cursordance.config` (Chrome storage), schema v2

### Data format (post-unification)
Theme packs store config in `workbenchDraft.actionConfigs` with ~50 flat fields per action covering: trigger, text, particle, ripple, audio, animation, image, cursor feedback.

Default action configs live in two places:
- **Runtime**: `config-store.js` → `getBaseActionConfigs()` (hardcoded for content script)
- **Workbench**: `actionConfigPresets.js` → `getDefaultActionConfigs(themeId)` (importable)

These must stay in sync. A test at `actionConfigSync.test.js` validates this automatically by comparing both outputs.

### AI Scheme Assistant + Agent
Workbench panel with two modes:
- **快速模式** — calls `POST /api/ai/scheme-proposals/stream` (SSE), model generates structured JSON proposal directly
- **Agent 模式** — calls `POST /api/ai/agent/run` (SSE), model uses Function Calling tools (`apply_config_patch`, `get_current_config`, `finalize_proposal`) in a ReAct loop (max 5 iterations) with per-step observability

Backend (`cursor-dance-api/`) is a standalone Node/FC project:
```
cursor-dance-api/src/
├── field-defs.js          # Shared schema constants (browser + Node)
├── sanitize.js            # Whitelist filter + numeric clamping + enum validation
├── errors.js              # Error message mapping
├── intent-repair.js       # Declarative rule registry (19 Chinese intent rules)
├── diff.js                # Config diff + change summaries
├── normalize.js           # Proposal normalization + request validation
├── client.js              # Browser HTTP client (fetch + SSE)
├── agent-tools.js         # Tool definitions (OpenAI function-calling format) + tool executor
├── model-provider.mjs     # DeepSeek API (chat_completions, streaming, tools)
├── agent-loop.mjs         # ReAct loop: think → act → observe → finalize
├── proposal-service.mjs   # Auth/rate-limit/CORS/orchestration
├── server.mjs             # Node HTTP server (local dev + FC entry)
└── index.mjs              # Unified re-export
```

Default model: `deepseek-chat` (configurable via `CURSORDANCE_AI_MODEL`). Full safety pipeline: JSON parse → whitelist filter → type/numeric/enum validation → intent repair (e.g., "不要声音" → `sound: false, volume: 0`) → proposal normalization.

### Runtime effects pipeline
DOM events (pointerdown/up/move, wheel, contextmenu) → `trigger-handlers.js` resolves cursor state binding and checks trigger zone/throttle/combo windows → `visual-effects.js` renders effects via Web Animations API (not CSS transitions — avoids layout thrashing with `contain`, `will-change`, `transform: translate3d`).

## Key conventions
- Use the shared `WorkbenchControls.jsx` primitives (Panel, FieldRow, ControlSlider, ColorOptions, etc.) for all workbench UI
- cursor modes use Chinese labels in workbench ("源"/"继承"/"覆盖"), English in runtime ("inherit"/"override")
- `mergeActionConfig(base, ...overlays)` handles textTags as arrays (replaced, not merged)
- Theme tone colors: amber, teal, sky, rose — mapped in `toneClasses()`

## Design
See [DESIGN.md](./DESIGN.md) for the project's visual design language ("克制柔软" / soft-minimal linear). All new UI work must follow the tokens and patterns defined there.

## No-go areas
- Do NOT add `behavior.click.effects` back — this old format was removed (2026-05-24)
- Do NOT rewrite `public/content.js` broadly; add focused runtime modules instead
- Keep popup, workbench, and content runtime data shapes synchronized
- Read `docs/project-stabilization-todo.md` and `docs/engineering-backlog.md` before large architecture changes
