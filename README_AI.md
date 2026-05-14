# CursorDance AI Context

## Product
- CursorDance is a browser extension for configurable mouse interaction effects.
- Users edit themes in a React Workbench, choose active themes in a popup, and see effects from the content runtime on pages.
- Core effects: floating text, particles, ripple, audio, image stickers, basic animation, cursor replacement, site rules, diagnostics.

## Tech Stack
- React 18 + Vite + Tailwind CSS.
- Extension assets live under `public/`; React entrypoints are `index.html` and `popup.html`.
- Tests: Vitest for config/model logic, Playwright for popup/workbench/runtime smoke flows.
- UI helpers are intentionally lightweight under `src/components/ui/`.

## App Entrypoints
- Workbench: `src/app/pages/theme-workbench/ThemeWorkbenchPage.jsx`.
- Popup: `src/app/pages/popup/PopupPage.jsx` and `src/app/pages/popup/usePopupState.js`.
- Main browser runtime: `public/content.js`, which assembles focused modules in `public/content-runtime/`.
- Default extension config: `public/config.js`; runtime config helpers: `public/config-runtime/`.

## Workbench Architecture
- State hook: `src/app/pages/theme-workbench/hooks/useThemeWorkbenchState.js`.
- Reducer/store: `src/app/pages/theme-workbench/hooks/themeWorkbenchStateStore.js`.
- Persistence/live preview: `useThemeWorkbenchPersistence.js` plus `lib/extensionConfig.js` and `lib/extensionStorage.js`.
- UI sections: `components/*Panel.jsx`; effect cards are under `components/panels/`.
- Shared Workbench controls: `components/WorkbenchControls.jsx`; base UI primitives: `src/components/ui/`.

## Runtime Architecture
- `public/content.js` wires config loading, local-preview messages, extension messages, and runtime modules.
- Effects render through `public/content-runtime/visual-effects.js`.
- Triggers resolve through `public/content-runtime/trigger-handlers.js`.
- Audio behavior is in `public/content-runtime/audio.js` with site profiles in `audio-duck-profile.js`.
- Cursor overlay is isolated in `public/content-runtime/cursor-overlay.js`.

## Config / Storage Flow
- Storage key: `cursordance.config`.
- Live preview key: `cursordance.livePreviewConfig`.
- Workbench drafts convert through `lib/themeDraftAdapter.js`.
- Canonical action field groups live in `model/actionConfigOptions.js` and `model/actionConfigSchema.js`.
- Saved Workbench state is embedded in theme packs as `workbenchDraft.actionConfigs`.

## Main Commands
- `npm run dev`: start Vite.
- `npm run build`: build extension/app output.
- `npm run test`: run Vitest.
- `npm run test:smoke`: run Playwright smoke tests.
- `npm run test:smoke:attached`: run smoke tests against an already running server.

## Test Strategy
- Use Vitest for conversion invariants, adapter behavior, runtime config helpers, diagnostics, and asset logic.
- Use Playwright for end-to-end local flows: popup theme selection, Workbench live preview, save persistence, runtime rendering, audio ducking.
- Smoke tests target local HTML pages: `smoke-target.html`, `test-target.html`, `popup.html`, and `index.html`.

## Current UX Debt
- Workbench should behave like a component-library quality editor: accessible dialogs, polished selects/sliders, clear save/export/import feedback, and robust color editing.
- Avoid broad redesigns before stabilizing the shared controls because effect cards reuse the same control layer.
- Popup redesign is intentionally deferred unless the user asks for it.

## Rules For Future AI Edits
- Preserve storage semantics unless the task explicitly asks for migration.
- Prefer editing shared controls before patching every effect card individually.
- Keep popup, Workbench, and content runtime data shapes synchronized with tests.
- Add or update smoke coverage when changing visible Workbench interactions.
- Do not rewrite `public/content.js` broadly; add focused runtime modules if behavior grows.
- Read `docs/project-stabilization-todo.md` and `docs/engineering-backlog.md` before large architecture changes.
