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
    ipc-channels.ts        Desktop IPC channel constants
    runtime.ts             PLATFORM / isDesktop() / isExtension()
  desktop/               Desktop app (Electron) — all desktop-only code
    main/                  Electron main process
    preload/               Context bridge
    renderer/              Electron renderer
      engine/              Effect engine (parity with extension/content-runtime/*)
      overlay/             Overlay window entry
      workbench/           Workbench window entry
```

Key rule: `src/app/` and `src/components/` contain shared UI, but the Popup is extension-only. `extension/` and `src/desktop/` are platform-specific.
Changes to `src/desktop/renderer/engine/` must be reflected in `extension/content-runtime/` and `extension/config-runtime/`.
