# CursorDance Project Stabilization TODO

Last updated: 2026-05-13

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
- The biggest remaining engineering risk is still concentrated in `public/content.js`.
- The project currently has no formal automated test stack in `package.json`.

## Priority Order

### P0: Stabilize Behavior Before Further Refactors

#### Task P0-1: Add unit test tooling

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

- Scope:
  - image-based click feedback in workbench
  - storage + preview + runtime support
- Dependencies:
  - recommended after `P1-2`
- Definition of done:
  - one image effect can be configured, previewed, saved, and rendered in content runtime

#### Task P2-3: Add basic animation effect panel

- Scope:
  - lightweight animation effect separate from text / particle / ripple
- Dependencies:
  - recommended after `P1-2`
- Definition of done:
  - at least one animation effect path works across editor, popup selection, and runtime

#### Task P2-4: Build asset center and diagnostics surfaces

- Scope:
  - asset management page or workspace
  - diagnostics page or panel
- Dependencies:
  - diagnostics should align with `P1-3`
- Definition of done:
  - users and developers have a visible place to inspect assets and debug state

#### Task P2-5: Site-specific audio validation

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

## Explicit Non-Goals For This Phase

- large visual redesigns unrelated to architecture or missing feature delivery
- speculative state model rewrites without a test harness
- replacing popup/workbench/content data flow again unless tests reveal a concrete defect
