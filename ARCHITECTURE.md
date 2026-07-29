# Project Architecture

```
extension/              Chrome extension (MV3) — IIFE modules, loaded by manifest.json
  config-runtime/        Config helpers (text-semantics, action-config, compute-specs)
  content-runtime/       Content script modules (visual-effects, audio, trigger-handlers, etc.)
  config.js              DI container + default configs
  content.js             DI container that wires all content-runtime modules
  manifest.json          Extension manifest

src/
  app/                   Shared UI — Workbench and extension Popup pages
  components/            Shared UI component library (Radix + Tailwind)
  shared/                Shared utilities + runtime detection
    effect-core/          Platform-neutral action/text/spec computation
    ipc-channels.ts        Desktop IPC channel constants
    desktop-ipc-contracts.ts Typed invoke request/response contracts
    runtime.ts             PLATFORM / isDesktop() / isExtension()
  desktop/               Desktop app (Electron) — all desktop-only code
    main/                  Electron main process
      ipc-security.ts      Per-window sender allowlist
      ipc-contracts.ts     Runtime payload and size validation
    preload/               Per-window context bridges
      bridges/             Cohesive IPC bridge factories
      workbench.ts         Config writes, dialogs, AI, window controls
      overlay.ts           Input events and read-only runtime state
    renderer/              Electron renderer
      engine/              Desktop effect runtime and platform adapters
      overlay/             Overlay window entry
      workbench/           Workbench window entry
```

Key rules:

- `src/app/` and `src/components/` contain shared UI, but the Popup is extension-only. `extension/` and `src/desktop/` are platform-specific.
- Pure action parsing, text semantics and effect spec computation live in `src/shared/effect-core/`. Shared core must not import DOM, Chrome, Electron or platform storage APIs.
- Platform adapters only resolve environment capabilities. For example, the desktop action-config adapter converts an asset id to a renderer URL; it does not duplicate shared parsing.
- `extension/config-runtime/` remains a transitional IIFE mirror covered by parity tests until the extension build moves to Vite in R4-3. After that migration it must consume `src/shared/effect-core/` directly.
