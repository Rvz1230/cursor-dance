# CLAUDE.md

## Session Startup
When starting a new session for **desktop app development**, read these two files first (in order):
1. `PROGRESS.md` — current phase, completed tasks, active branch, blockers
2. `steady-painting-yeti-prompts.md` — copy the prompt for the next unchecked task

Do NOT re-read the full plan (`docs/plans/steady-painting-yeti.md`) unless crossing a phase boundary or hitting an unexpected issue not covered by the prompts.

## Language
All new code must be written in **TypeScript** (`.ts` / `.tsx`). Legacy `.js` / `.jsx` files may be migrated incrementally but new features, components, and utilities must use TypeScript from the start.

## Overview
CursorDance is both a **Chrome extension (Manifest V3)** and an **Electron desktop application** (in development). It adds customizable mouse interaction effects — particles, ripples, text, animations, custom cursors — to web pages (extension) or to the entire OS desktop (desktop app via transparent overlay windows).

The repo uses **npm workspaces** for monorepo management:
- `cursor-dance-api/` — standalone Node.js AI API server
- `landing/` — independent Vite landing page build
- Root — core extension (Vite MPA: workbench + popup + content scripts) + desktop app (electron-vite: main + preload + renderer)

See `ARCHITECTURE.md` for the directory layout and platform boundaries.

## Commands
```
# Extension
npm run dev           # Vite dev server (workbench + popup)
npm run build         # Production build → dist/
npm run test          # Vitest unit tests (98 tests across 15 files)
npm run test:smoke    # Playwright E2E smoke tests
npm run ai:dev        # AI API server (scripts/ai-api-server.mjs)

# Desktop (Electron)
npm run dev:electron  # electron-vite dev
npm run build:electron # electron-vite build
npm run package:mac   # electron-builder --mac
npm run package:win   # electron-builder --win
```

## Architecture

### Shared design system
- `DESIGN.md` — unified design language (colors, typography, spacing, radius, shadows, motion, interaction states). Applies to both extension and desktop.
- `DESIGN-desktop.md` — desktop-only UI surfaces (window chrome, tray, keyboard shortcuts, branding)
- Design tokens and UI components in `src/components/ui/` are shared across extension and desktop

### Chrome Extension (existing)
- Three entrypoints: Workbench (`index.html`), Popup (`popup.html`), Content scripts (`extension/`)
- Content scripts use IIFE registration (`window.CursorDanceContentModules`) because ES modules aren't available
- Storage: `chrome.storage.local` with localStorage fallback
- Build: Vite 5 MPA (`vite.config.js`)

### Electron Desktop App (new)
```
src/
├── app/                # Shared UI — Workbench + Popup pages (both platforms)
├── components/         # Shared UI component library
├── shared/             # Shared utilities + runtime detection
│   ├── ipc-channels.ts   # Desktop IPC channel constants
│   └── runtime.ts        # PLATFORM / isDesktop() / isExtension()
└── desktop/            # Desktop app (Electron) — all desktop-only code
    ├── main/              # Electron main process
    │   ├── index.ts       # App lifecycle, single-instance lock
    │   ├── windows.ts     # createOverlayWindow, createWorkbenchWindow
    │   ├── tray.ts        # System tray + context menu
    │   ├── ipc-handlers.ts # All ipcMain.handle registrations
    │   ├── native-events.ts # uiohook-napi global mouse capture
    │   ├── electron-store.ts # electron-store config persistence
    │   └── api-server.ts  # cursor-dance-api embedded in main process
    ├── preload/
    │   └── index.ts       # contextBridge: cursorDanceAPI, cursorDanceStorage
    └── renderer/
        ├── engine/        # Shared effect engine (used by both Workbench preview AND overlay)
        │   ├── visual-effects.ts   # Element.animate() rendering
        │   ├── cursor-overlay.ts   # Software cursor
        │   ├── audio.ts            # Web Audio API synthesis
        │   ├── trigger-handlers.ts # Event → action pipeline
        │   ├── config-store.ts     # Config resolution
        │   ├── compute-specs.ts    # Particle/ripple/animation math
        │   ├── action-config.ts    # Action config field pickers
        │   ├── text-semantics.ts   # Text classification (pure data)
        │   ├── default-config.ts   # Default action configs
        │   ├── app-matcher.ts      # App rule matching (replaces site-matcher)
        │   └── diagnostics.ts      # Runtime event logging
        ├── workbench/     # ThemeWorkbenchPage (reused from extension)
        ├── overlay/       # Overlay window entry (thin: IPC binding → engine)
        └── popup/         # Tray popup panel (reused from extension)
```

### Content script module system (extension only)
Content scripts can't use ES modules, so `extension/` uses IIFE registration via `window.CursorDanceContentModules`. Load order (defined in `manifest.json`):
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
    ├── sites (SiteRulesPanel)   # Per-host site rules (extension) / per-app rules (desktop)
    └── diagnostics          # Diagnostic event viewer
```

### State management
- `themeWorkbenchStateStore.js` — `useReducer` with 20+ action types
- `useThemeWorkbenchState.js` — Main hook exposing all state + actions
- `useThemeWorkbenchPersistence.js` — Extension: hydrates from `chrome.storage.local`. Desktop: hydrates via IPC → `electron-store`
- Key: `cursordance.config` (Chrome storage / electron-store), schema v2

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

Desktop replaces the storage backend with a `StorageAdapter` interface:
- Extension: `ChromeStorageAdapter` (wraps `chrome.storage.local/session` + localStorage fallback)
- Desktop: `ElectronStoreAdapter` (wraps `electron-store` via IPC)

### AI Scheme Assistant + Agent
Workbench panel with two modes:
- **快速模式** — calls `POST /api/ai/scheme-proposals/stream` (SSE), model generates structured JSON proposal directly
- **Agent 模式** — calls `POST /api/ai/agent/run` (SSE), model uses Function Calling tools (`apply_config_patch`, `get_current_config`, `rollback`, `finalize_proposal`) in a ReAct loop (max 5 iterations) with per-step observability

Backend (`cursor-dance-api/`) is a standalone Node/FC project.

Desktop: the API server runs as an embedded module in the main process or as a forked child process. API endpoint is configurable via `electron-store` (not build-time `VITE_*` env vars).

### Runtime effects pipeline
DOM events (extension) or global mouse IPC events (desktop) → `trigger-handlers.js/ts` resolves cursor state binding and checks trigger zone/throttle/combo windows → `visual-effects.js/ts` renders effects via Web Animations API.

Desktop trigger actions: leftClick, rightClick, doubleClick, longPress, wheel (5 actions; no hover — no DOM to hover over).

Desktop removes: audio ducking (no page media to duck), site-matcher (replaced by app-matcher), atmosphere magnet/text-selection modes (DOM-dependent).

### Landing page (`landing/`)
Independent Vite + React build for the public website. Not part of the Electron app.

## Design
- `DESIGN.md` — unified design language for both extension and desktop (colors, typography, spacing, radius, shadows, motion)
- `DESIGN-desktop.md` — desktop-only UI surfaces (window chrome, tray, keyboard, branding)

## No-go areas

### Extension-specific
- Do NOT add `behavior.click.effects` back — this old format was removed (2026-05-24)
- Do NOT rewrite `extension/content.js` broadly; add focused runtime modules instead
- Keep popup, workbench, and content runtime data shapes synchronized

### Desktop-specific
- Do NOT introduce a second component library (MUI, Ant Design, shadcn CLI). Use existing `src/components/ui/` + Radix UI
- Do NOT mix native widgets with Chromium-rendered UI — all UI surfaces use the same design tokens
- Do NOT add `hover` trigger action on desktop (no DOM context)
- Do NOT add audio ducking on desktop (no page media)
- Do NOT let engine logic diverge between extension and desktop — changes to `src/desktop/renderer/engine/` must be reflected in `extension/content-runtime/` equivalents

### General
- Read `docs/project-stabilization-todo.md` and `docs/engineering-backlog.md` before large architecture changes
- Keep `npm run build` (extension) and `npm run test` green — do not break the extension while building the desktop app
