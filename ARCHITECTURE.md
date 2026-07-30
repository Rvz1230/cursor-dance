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
