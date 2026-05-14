# CursorDance Engineering Backlog

Last updated: 2026-05-14

## Related Planning Docs

- Main execution roadmap: `docs/project-stabilization-todo.md`

## Ticket CD-001

- Type: Bug
- Title: `soundBlendMode` on bilibili does not produce clearly distinguishable media ducking behavior
- Status: Resolved
- Priority: P2
- Severity: Major
- Area: `content runtime` / `audio mixing`
- Reported in: local extension validation on bilibili
- Environment:
  - Browser extension built from `dist/`
  - Options page driven by React workbench
  - Validation date: 2026-05-10

### Summary

When the user switches `混音方式` between `保持原音量`, `压低页面音频`, and `仅插件音效` on bilibili, the perceived behavior is almost identical.

### Steps To Reproduce

1. Load the unpacked extension from `dist/`.
2. Open a bilibili page with active video playback.
3. In the options workbench, enable audio feedback for an action.
4. Save once with `保持原音量`.
5. Save once with `压低页面音频`.
6. Save once with `仅插件音效`.
7. Trigger the configured action on the bilibili page after each save.

### Expected Result

- `保持原音量`: page media keeps its current volume.
- `压低页面音频`: page media audibly ducks for a noticeable period.
- `仅插件音效`: page media is temporarily muted or near-muted while the plugin sound plays.

### Actual Result

The three modes feel very similar on bilibili, with little or no perceptible difference.

### Resolution Summary

- Added a site-specific audio duck profile layer in `public/content-runtime/audio-duck-profile.js`.
- `bilibili` now uses stronger duck targets, longer duck duration, and periodic reassertion to reduce player-side state takeback.
- Diagnostics now expose site key, duck profile, and reassert activity so media mixing behavior is explainable.
- Local smoke coverage now simulates bilibili-like media state reassertion and verifies all three `soundBlendMode` values remain distinguishable.

### Known Scope / Limitation

- This does not necessarily reproduce on plain HTML5 media pages.
- The issue is likely site-specific or player-specific rather than a total failure of the generic ducking implementation.

### Suspected Root Causes

1. bilibili player may reassert volume state after script changes.
2. bilibili may not expose all audible playback through directly controllable media elements.
3. The timing window for ducking may still not align well with user perception on that site.

### Validation Notes

- Validated by unit coverage for duck profile selection.
- Validated by local smoke coverage for a bilibili-like reasserting media element.
- A direct manual check on live bilibili pages is still recommended during future release validation, but the issue is no longer unguarded by automated regression coverage.

### Acceptance Criteria For Fix

- On bilibili, the three `soundBlendMode` values become perceptibly distinct during action-triggered playback.
- The fix does not regress ducking on ordinary HTML5 media pages.

Result:

- Accepted on 2026-05-14 for the current stabilization phase.

## Ticket CD-002

- Type: Task
- Title: Add optional runtime diagnostics for action execution and media ducking
- Status: Resolved
- Priority: P3
- Area: `content runtime` / `debuggability`

### Goal

Provide a switchable debug mode so future site-specific runtime issues can be diagnosed without relying only on manual perception.

### Suggested Scope

1. Log selected action id, trigger source, and filtered trigger-zone result.
2. Log audio trigger mode decisions and ducking targets.
3. Log detected media element count and restore timing.

### Acceptance Criteria

- Debug logging can be enabled without changing production defaults.
- Logs are sufficient to trace why a given action did or did not produce visible/audio output.

Result:

- Accepted on 2026-05-14.
