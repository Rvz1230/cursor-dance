import { describe, expect, it } from "vitest";
import {
  appendDiagnosticEntry,
  diagnosticReasonLabel,
  groupDiagnosticEntries,
  summarizeLivePreviewConfig,
} from "./diagnosticsSurface";

describe("diagnosticsSurface", () => {
  it("keeps only the most recent diagnostic entries", () => {
    const entries = Array.from({ length: 5 }, (_, index) => ({ scope: `event-${index + 1}` }));
    const nextEntries = appendDiagnosticEntry(entries.slice(0, 4), entries[4], 3);

    expect(nextEntries).toEqual([{ scope: "event-3" }, { scope: "event-4" }, { scope: "event-5" }]);
  });

  it("describes live preview state for current and absent themes", () => {
    expect(summarizeLivePreviewConfig(null, "mono-geo")).toMatchObject({
      status: "inactive",
      activeThemeId: "",
    });

    expect(
      summarizeLivePreviewConfig(
        {
          activeThemeId: "mono-geo",
          themes: [{ id: "mono-geo" }],
        },
        "mono-geo"
      )
    ).toMatchObject({
      status: "current",
      activeThemeId: "mono-geo",
      themeCount: 1,
    });
  });

  it("groups one trigger chain and keeps the newest group first", () => {
    const groups = groupDiagnosticEntries([
      { at: "2026-08-07T10:00:00.000Z", scope: "trigger-zone.check", actionId: "leftClick", matched: true },
      { at: "2026-08-07T10:00:00.010Z", scope: "action.resolve", sourceActionId: "leftClick" },
      { at: "2026-08-07T10:00:00.020Z", scope: "action.fire", sourceActionId: "leftClick", outputs: { textEnabled: true, rippleEnabled: true } },
      { at: "2026-08-07T10:00:00.100Z", scope: "trigger-zone.check", actionId: "wheel", matched: false },
      { at: "2026-08-07T10:00:00.110Z", scope: "action.skip", sourceActionId: "wheel", reason: "trigger-zone-filtered" },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ trigger: "wheel", result: "skip", reason: "trigger-zone-filtered" });
    expect(groups[1]).toMatchObject({ trigger: "leftClick", result: "fire", outputs: ["飘字", "波纹"] });
    expect(diagnosticReasonLabel(groups[0].reason)).toBe("不在触发区域内");
  });

  it("keeps the handler and pipeline zone checks in one trigger group", () => {
    const groups = groupDiagnosticEntries([
      { at: "2026-08-07T10:00:00.000Z", scope: "trigger-zone.check", actionId: "wheel", matched: true },
      { at: "2026-08-07T10:00:00.002Z", scope: "trigger-zone.check", actionId: "wheel", matched: true },
      { at: "2026-08-07T10:00:00.010Z", scope: "action.resolve", sourceActionId: "wheel" },
      { at: "2026-08-07T10:00:00.020Z", scope: "action.fire", sourceActionId: "wheel" },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ trigger: "wheel", result: "fire" });
    expect(groups[0].entries).toHaveLength(4);
  });

  it("treats a rejected outer zone check as a completed skipped trigger", () => {
    const groups = groupDiagnosticEntries([
      { at: "2026-08-07T10:00:00.000Z", scope: "trigger-zone.check", actionId: "wheel", matched: false },
      { at: "2026-08-07T10:00:00.100Z", scope: "trigger-zone.check", actionId: "wheel", matched: false },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ trigger: "wheel", result: "skip", reason: "trigger-zone-filtered" });
    expect(groups[1]).toMatchObject({ trigger: "wheel", result: "skip", reason: "trigger-zone-filtered" });
  });

  it("keeps a fallback as a fired third result instead of a skip", () => {
    const [group] = groupDiagnosticEntries([
      { at: "2026-08-07T10:00:00.000Z", scope: "keyboard.anchor-fallback", reason: "caret-unavailable" },
      { at: "2026-08-07T10:00:00.010Z", scope: "action.fire", sourceActionId: "leftClick" },
    ]);

    expect(group).toMatchObject({ result: "fallback", reason: "content-signal-unavailable" });
  });

  it("keeps keyboard fallback telemetry with its keyboard fire event", () => {
    const groups = groupDiagnosticEntries([
      { at: "2026-08-07T10:00:00.000Z", scope: "runtime.ready" },
      { at: "2026-08-07T10:00:00.010Z", scope: "keyboard.anchor-fallback", reason: "caret-unavailable" },
      { at: "2026-08-07T10:00:00.020Z", scope: "keyboard.fire", activeKeyEffects: 1 },
      { at: "2026-08-07T10:00:00.100Z", scope: "keyboard.fire", activeKeyEffects: 2 },
    ]);

    expect(groups).toHaveLength(3);
    expect(groups[0].entries).toHaveLength(1);
    expect(groups[1].scopes).toEqual(["keyboard.anchor-fallback", "keyboard.fire"]);
    expect(groups[2].scopes).toEqual(["runtime.ready"]);
  });

  it("does not merge runtime bookkeeping into the next trigger", () => {
    const groups = groupDiagnosticEntries([
      { at: "2026-08-07T10:00:00.000Z", scope: "app-rule.context", processName: "Figma" },
      { at: "2026-08-07T10:00:00.010Z", scope: "trigger-zone.check", actionId: "leftClick", matched: true },
      { at: "2026-08-07T10:00:00.020Z", scope: "action.fire", sourceActionId: "leftClick" },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ trigger: "leftClick", result: "fire" });
    expect(groups[1]).toMatchObject({ trigger: "app-rule.context", result: "info" });
  });
});
