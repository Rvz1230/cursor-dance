# Project Architecture

```
extension/                MV3 manifest and static extension assets only

src/
  app/                     Shared Workbench and Popup UI
  components/              Shared UI component library (Radix + Tailwind)
  extension/               Typed Chrome content runtime and platform adapters
    content-entry.ts        Vite content-bundle entry
    content-runtime.ts      Adapter composition and lifecycle
  shared/
    domain/                 Canonical application domain model
    config/                 Canonical v4 defaults, themes and key feedback config
    effect-core/            Platform-neutral action/text/spec computation
    effect-runtime/         Shared runtime state machines and DOM/audio surfaces
    config-schema-v4.ts     Strict persisted configuration contract
    ipc-channels.ts         Desktop IPC channel constants
    desktop-ipc-contracts.ts Typed invoke request/response contracts
    runtime.ts              PLATFORM / isDesktop() / isExtension()
  desktop/                 Electron-only code
    main/                    Main process, windows, persistence and native input
    preload/                 Per-window restricted context bridges
    renderer/
      engine/                Desktop input/context adapters
      overlay/               Overlay window entry
      workbench/             Workbench window entry
```

Key rules:

- `src/app/` and `src/components/` contain shared UI. `src/extension/` and `src/desktop/` contain platform adapters; `extension/` contains no executable source.
- Persisted configuration is v4-only. Defaults and strict normalization have one source in `src/shared/config/` and `src/shared/config-schema-v4.ts`; platform code must not publish configuration through window globals.
- Pure action parsing, text semantics and effect spec computation live in `src/shared/effect-core/`. Shared core must not import DOM, Chrome, Electron or platform storage APIs.
- Platform adapters only resolve environment capabilities. For example, the desktop action-config adapter converts an asset id to a renderer URL; it does not duplicate shared parsing.
- Runtime input, context, effect surface and audio capabilities depend on contracts in `src/shared/effect-runtime/`; platform entry points own the concrete adapters and their lifecycle.
- The Chrome content runtime is authored as TypeScript and bundled to one MV3-compatible IIFE by Vite. Do not reintroduce classic runtime scripts, source-string execution or global module registries.

## Workbench boundaries

The Workbench edits one canonical theme aggregate. Presentation metadata and the editable draft stay together in `WorkbenchTheme`; persistence converts that aggregate to the shared v4 domain model at the repository boundary.

```text
ThemeWorkbenchPage
  -> scene hooks and commands
    -> domain / editor / status / runtime state slices
    -> editing / state / persistence modules
      -> WorkbenchRepository
        -> Chrome, local-preview, or Electron adapter
```

- Page components render state and dispatch user intent; they do not call platform storage directly.
- `hooks/state/` contains pure reducers and state operations.
- `hooks/persistence/` owns hydration, live preview, editor state and save coordination.
- `workbench*Commands.ts` owns user workflows that cross state and persistence boundaries.
- `lib/theme-draft/` converts between the canonical domain and editor drafts.
- Runtime code consistently uses `theme`, `themeId` and `getActiveTheme`. The AI API's historical `scheme` DTO is isolated behind its adapter.

## Component boundaries

- Reusable UI primitives live in `src/components/ui/`, use kebab-case filenames and are imported from their concrete file.
- Product-specific components live beside their page and use PascalCase filenames.
- Do not add component barrels or mixed aggregation files such as the removed `WorkbenchControls`.
- `scripts/check-code-conventions.mjs` enforces these naming and dependency-entry rules in CI.

## Verification boundaries

- Unit tests prove pure domain, reducer, adapter and runtime behavior.
- Web smoke proves Workbench/Popup/live-preview integration in Chromium.
- Extension smoke proves the production MV3 bundle under extension CSP.
- Desktop smoke proves the Electron window lifecycle and real renderer/preload integration.
- Bundle budgets protect the extension content runtime and Electron renderer from silent regressions.
