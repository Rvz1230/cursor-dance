# CursorDance Project Stabilization TODO

Last updated: 2026-05-14

## Goal

This document turns the current architecture and feature gaps into an execution-ready task list.

The project is no longer in a structurally unstable state. The next phase should shift from broad refactoring to:

1. locking in behavior with tests
2. reducing the runtime maintenance risk in `public/content.js`
3. completing the remaining product features

## Current Baseline

- Config semantics are mostly unified across `popup`, `workbench`, and `content runtime`.
- Storage, live preview, and draft adaptation have already been separated into dedicated modules.
- Action config semantics now have shared grouping helpers used by adapter, preview, and runtime reads.
- `public/content.js` has been reduced to a runtime assembly layer, with focused modules under `public/content-runtime/`.
- The project now has `vitest` unit coverage and Playwright smoke coverage exposed through `package.json`.

## Completion Snapshot

The stabilization plan defined in this document has been completed.

- `P0-1` done: lightweight unit testing added with `vitest`, plus `test` / `test:watch` scripts.
- `P0-2` done: config conversion invariants and adapter regressions are covered.
- `P0-3` done: browser-level smoke coverage exists for popup/workbench/runtime sync.
- `P1-1` done: `public/content.js` has been split into focused runtime modules.
- `P1-2` done: `actionConfig` storage and editor boundaries are formalized.
- `P1-3` done: switchable runtime diagnostics exist and can be viewed from the workbench.
- `P2-1` done: theme duplicate / delete / export lifecycle is complete.
- `P2-2` done: image effect editing, preview, storage, and runtime rendering are connected.
- `P2-3` done: a basic animation effect path works across editor, popup selection, and runtime.
- `P2-4` done: asset center and diagnostics surfaces are visible in dedicated workspaces.
- `P2-5` done: bilibili-oriented audio ducking validation now has a site-specific profile plus local smoke regression coverage.

## Priority Order

### P0: Stabilize Behavior Before Further Refactors

#### Task P0-1: Add unit test tooling

Status: Done on 2026-05-14

- Scope:
  - add a lightweight test runner for config and adapter logic
  - add `test` and `test:watch` scripts in `package.json`
- Suggested target:
  - `vitest`
- Files likely involved:
  - `package.json`
  - `vite.config.js`
  - `src/app/pages/theme-workbench/lib/runtimeConfig.js`
  - `src/app/pages/theme-workbench/lib/themeDraftAdapter.js`
- Definition of done:
  - local test command exists and runs successfully
  - project can execute isolated logic tests without browser extension packaging

#### Task P0-2: Cover config conversion invariants

Status: Done on 2026-05-14

- Scope:
  - verify `themePack -> workbenchDraft -> stored themePack` round-trip behavior
  - verify live-preview overlay does not overwrite persisted config semantics
  - verify text-effect inference for number/text modes
- Files likely involved:
  - `src/app/pages/theme-workbench/lib/themeDraftAdapter.js`
  - `src/app/pages/theme-workbench/lib/runtimeConfig.js`
  - `public/config.js`
- Suggested test cases:
  - woodfish text config preserves number mode semantics
  - custom text tags preserve order and primary text
  - `comboEnabled` is respected after fallback inference
  - cursor state inheritance remains stable after hydration
- Definition of done:
  - regression cases for previously fixed popup/content mismatches are covered

#### Task P0-3: Add runtime behavior smoke tests

Status: Done on 2026-05-14

- Scope:
  - validate theme switching, live preview, and persisted reload flow
  - validate popup-selected theme matches content runtime effect output
- Suggested target:
  - Playwright or another browser-level smoke tool
- Files likely involved:
  - `public/content.js`
  - `src/app/pages/popup/usePopupState.js`
  - `src/app/pages/theme-workbench/hooks/useThemeWorkbenchState.js`
  - `src/app/pages/theme-workbench/lib/extensionStorage.js`
- Definition of done:
  - at least one automated flow covers:
    - select theme in popup
    - observe runtime effect
    - edit draft in workbench without saving
    - observe live preview override
    - close/reset draft and observe fallback to saved state

### P1: Reduce Runtime Maintenance Risk

#### Task P1-1: Split `public/content.js` into internal runtime modules

Status: Done on 2026-05-14

- Why:
  - this is still the single largest maintenance hotspot
- Suggested split:
  - `runtime-config-read`
  - `runtime-trigger-handlers`
  - `runtime-visual-effects`
  - `runtime-audio`
  - `runtime-cursor-overlay`
- Constraint:
  - keep external behavior unchanged
  - keep extension packaging output compatible with current manifest usage
- Files likely involved:
  - `public/content.js`
  - `public/config.js`
- Definition of done:
  - event wiring, rendering, audio, and cursor overlay logic are not all mixed in one file
  - each module has one obvious responsibility

#### Task P1-2: Formalize `actionConfig` model boundaries

Status: Done on 2026-05-14

- Why:
  - grouping helpers exist, but storage shape is still a large flat object
- Scope:
  - document which fields are:
    - runtime semantics
    - editor-only form state
    - preview-only derived state
  - remove any remaining duplicated or derived fields from stored draft shape where safe
- Files likely involved:
  - `src/app/pages/theme-workbench/model/actionConfigSchema.js`
  - `src/app/pages/theme-workbench/lib/themeDraftAdapter.js`
  - `src/app/pages/theme-workbench/lib/preview.js`
- Definition of done:
  - new action fields have a single obvious home
  - adapter logic does not need to guess whether a field is canonical or derived

#### Task P1-3: Add optional runtime diagnostics

Status: Done on 2026-05-14

- Scope:
  - build on backlog item `CD-002`
  - add a switchable debug channel for action resolution, trigger-zone filtering, and media ducking
- Files likely involved:
  - `public/content.js`
  - future debug setting entry in workbench or hidden flag
- Definition of done:
  - a developer can explain why an action did or did not fire without manual guesswork

### P2: Complete Missing Product Features

#### Task P2-1: Theme management completeness

Status: Done on 2026-05-14

- Scope:
  - duplicate theme
  - delete theme
  - export theme JSON
- Files likely involved:
  - `src/app/pages/theme-workbench/components/ThemeLibrarySidebar.jsx`
  - `src/app/pages/theme-workbench/hooks/useThemeWorkbenchState.js`
  - `src/app/pages/theme-workbench/lib/extensionStorage.js`
- Definition of done:
  - user can fully manage theme lifecycle without hand-editing storage

#### Task P2-2: Add image effect panel

Status: Done on 2026-05-14

- Scope:
  - image-based click feedback in workbench
  - storage + preview + runtime support
- Dependencies:
  - recommended after `P1-2`
- Definition of done:
  - one image effect can be configured, previewed, saved, and rendered in content runtime

#### Task P2-3: Add basic animation effect panel

Status: Done on 2026-05-14

- Scope:
  - lightweight animation effect separate from text / particle / ripple
- Dependencies:
  - recommended after `P1-2`
- Definition of done:
  - at least one animation effect path works across editor, popup selection, and runtime

#### Task P2-4: Build asset center and diagnostics surfaces

Status: Done on 2026-05-14

- Scope:
  - asset management page or workspace
  - diagnostics page or panel
- Dependencies:
  - diagnostics should align with `P1-3`
- Definition of done:
  - users and developers have a visible place to inspect assets and debug state

#### Task P2-5: Site-specific audio validation

Status: Done on 2026-05-14

- Scope:
  - continue investigation from backlog item `CD-001`
  - validate bilibili media ducking behavior after diagnostics tooling exists
- Definition of done:
  - three `soundBlendMode` values are perceptibly distinct on bilibili

## Recommended Execution Sequence

1. Finish `P0-1` to `P0-3`
2. Only then start `P1-1`
3. Finish `P1-2` before adding new effect types
4. Use `P1-3` diagnostics to support `P2-5`
5. Deliver `P2-1` before broader feature expansion, because theme lifecycle is a core user path

## Stop Conditions

The project can be treated as "engineering-stable enough to focus on features" when all of the following are true:

- config conversion tests exist and pass
- at least one browser-level smoke test covers popup/workbench/runtime sync
- `public/content.js` is no longer a single large mixed-responsibility file
- theme lifecycle actions cover create, import, duplicate, delete, and export

Current status:

- All stop conditions above are satisfied as of 2026-05-14.

## Explicit Non-Goals For This Phase

- large visual redesigns unrelated to architecture or missing feature delivery
- speculative state model rewrites without a test harness
- replacing popup/workbench/content data flow again unless tests reveal a concrete defect

## Recommended Next Focus

Now that the stabilization plan is complete, the next phase should prefer small, low-risk cleanups over new architecture churn.

1. Split hotspot helpers inside `public/config.js` to reduce runtime adapter sprawl.
2. Break `useThemeWorkbenchState.js` into narrower hooks for hydration, theme lifecycle, and live preview side effects.
3. Separate `actionConfigSchema.js` into field groups, presets, and storage helpers so new effect cards do not keep expanding one file.
4. Consider splitting `visual-effects.js` by effect type if another major runtime effect is introduced.

## Current Hotspots

As of 2026-05-14, the largest remaining files are:

- `public/config.js`: 694 lines
- `src/app/pages/theme-workbench/model/actionConfigSchema.js`: 632 lines
- `src/app/pages/theme-workbench/hooks/useThemeWorkbenchState.js`: 605 lines
- `public/content-runtime/visual-effects.js`: 544 lines
