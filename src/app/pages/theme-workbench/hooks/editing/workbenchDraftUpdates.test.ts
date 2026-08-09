import { describe, expect, it } from "vitest";

import { createThemeDraft } from "../../model/workbenchSchema";
import {
  applyActionConfigPatch,
  applyActionConfigPatches,
  applyAtmospherePatch,
  applyKeyFeedbackConfigPatch,
  getActionPatchMergeKey,
  getKeyFeedbackPatchMergeKey,
} from "./workbenchDraftUpdates";

describe("workbenchDraftUpdates", () => {
  it("patches one action without replacing unrelated action configs", () => {
    const draft = createThemeDraft("mono-geo");
    const next = applyActionConfigPatch(draft, "leftClick", { textContent: "已更新" });

    expect(next.actionConfigs.leftClick.textContent).toBe("已更新");
    expect(next.actionConfigs.rightClick).toBe(draft.actionConfigs.rightClick);
    expect(next.cursorSkin).toBe(draft.cursorSkin);
  });

  it("patches multiple actions and preserves unspecified fields", () => {
    const draft = createThemeDraft("mono-geo");
    const next = applyActionConfigPatches(draft, {
      leftClick: { textContent: "左键" },
      rightClick: { textContent: "右键" },
    });

    expect(next.actionConfigs.leftClick.textContent).toBe("左键");
    expect(next.actionConfigs.rightClick.textContent).toBe("右键");
    expect(next.actionConfigs.leftClick.particle).toBe(draft.actionConfigs.leftClick.particle);
  });

  it("patches atmosphere and generates stable merge keys", () => {
    const draft = createThemeDraft("mono-geo");
    const next = applyAtmospherePatch(draft, { mode: "follow", strength: 0.8 });

    expect(next.atmosphere).toEqual({ ...draft.atmosphere, mode: "follow", strength: 0.8 });
    expect(getActionPatchMergeKey("leftClick", { textColor: "#fff", fontSize: 20 }))
      .toBe("leftClick:fontSize,textColor");
  });

  it("patches keyboard feedback through the shared draft and merges only single-field edits", () => {
    const draft = createThemeDraft("mono-geo");
    const next = applyKeyFeedbackConfigPatch(draft, { fontSize: 72 });

    expect(next.keyFeedbackConfig.fontSize).toBe(72);
    expect(next.actionConfigs).toBe(draft.actionConfigs);
    expect(getKeyFeedbackPatchMergeKey({ fontSize: 72 })).toBe("key-feedback:fontSize");
    expect(getKeyFeedbackPatchMergeKey({ fontSize: 72, color: "#00FFAA" })).toBeUndefined();
  });
});
