# CLAUDE.md

## Language
All new code must be written in **TypeScript** (`.ts` / `.tsx`). Legacy `.js` / `.jsx` files may be migrated incrementally but new features, components, and utilities must use TypeScript from the start.

## Overview
CursorDance is a Chrome extension (Manifest V3) that adds customizable mouse interaction effects to web pages. Users edit themes in a React Workbench (options page), pick active themes in a popup, and effects render via content scripts on all pages.

The repo uses **npm workspaces** for monorepo management:
- `cursor-dance-api/` — standalone Node.js AI API server
- `landing/` — independent Vite landing page build
- Root — core extension (Vite MPA: workbench + popup + content scripts)

## Commands
```
npm run dev           # Vite dev server (workbench + popup)
npm run build         # Production build → dist/
npm run test          # Vitest unit tests (98 tests across 15 files)
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
    ├── sites (SiteRulesPanel)   # Per-host site rules (ordered, glob support)
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

### Storage module (`src/app/pages/theme-workbench/lib/storage/`)
Chrome Storage API wrappers, split by responsibility (was `extensionStorage.js`, 622 lines):
```
lib/storage/
├── chrome-api.js       # Constants + Chrome API helpers (getChromeApi, canUseLocalStorage, etc.)
├── config-io.js        # Read/write/clear config (extension + live preview) via chrome.storage
├── subscriptions.js    # Storage change listeners (extension config, live preview, runtime diagnostics)
├── extras.js           # Theme export, cursor assets, site context, preview, runtime errors, debug flag
└── index.js            # Barrel re-export (extensionStorage.js re-exports from here)
```

### AI Scheme Assistant + Agent
Workbench panel with two modes:
- **快速模式** — calls `POST /api/ai/scheme-proposals/stream` (SSE), model generates structured JSON proposal directly
- **Agent 模式** — calls `POST /api/ai/agent/run` (SSE), model uses Function Calling tools (`apply_config_patch`, `get_current_config`, `rollback`, `finalize_proposal`) in a ReAct loop (max 5 iterations) with per-step observability

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

cursor-dance-api/tests/    # 157 tests across 9 files (node --test)
├── sanitize.test.js            # 30 tests — clampNumber, normalizeHexColor, sanitizeAiSchemePatch, mergeActionConfig
├── errors.test.js              # 8 tests — timeout, network, auth, body size, schema, provider errors
├── field-defs.test.js          # 6 tests — NUMERIC_LIMITS, ENUM_OPTIONS, AI_SCHEME_PATCH_FIELDS completeness
├── diff.test.js                # 7 tests — formatDiffValue, buildAiSchemeDiffItems
├── intent-repair.test.js       # 10 tests — soundOff, shakeOff, rippleOnly, particleOff, etc.
├── normalize.test.js           # 12 tests — validateAiSchemeRequest, normalizeAiSchemeProposal, buildAiProposalContext
├── proposal-service.test.js    # 31 tests — CORS, auth, request limits, health, serialization
├── agent-tools.test.js         # 30 tests — tool definitions, describeAgentToolCall, createToolExecutor, rollback
└── agent-loop.test.js          # Existing — agent loop integration tests
```

Default model: `deepseek-chat` (configurable via `CURSORDANCE_AI_MODEL`). Full safety pipeline: JSON parse → whitelist filter → type/numeric/enum validation → intent repair (e.g., "不要声音" → `sound: false, volume: 0`) → proposal normalization.

### Runtime effects pipeline
DOM events (pointerdown/up/move, wheel, contextmenu) → `trigger-handlers.js` resolves cursor state binding and checks trigger zone/throttle/combo windows → `visual-effects.js` renders effects via Web Animations API (not CSS transitions — avoids layout thrashing with `contain`, `will-change`, `transform: translate3d`).

### Landing page (`landing/`)
Independent Vite + React build for the public website. Shares `framer-motion` version with root (`^10.16.4`). Uses `src/shared-entry.jsx` for MPA entry point deduplication. Has its own test suite:
- `landing/src/lib/utils.test.js` — 6 tests for `cn()` (keep in sync with `src/components/ui/utils.js`)
- `landing/src/lib/presets.test.js` — 7 tests for PRESETS data integrity
- `landing/src/lib/scroll.test.js` — 4 tests for navLinks structure

### CI/CD
`.github/workflows/ci.yml` — 3 jobs: `test-root` (vitest + playwright smoke), `test-api` (node --test), `build` (root build + landing build).

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
