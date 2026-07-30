import { describe, expect, it } from "vitest";
import {
  buildAiPreviewActionConfigs,
  createAiActionSnapshot,
  getProposalActionPatches,
  hasAiPreviewForAction,
} from "./useWorkbenchAiPreview";

describe("Workbench AI preview state", () => {
  it("keeps only valid non-empty action targets", () => {
    expect(getProposalActionPatches({
      targets: [
        { type: "action", actionId: "leftClick", patch: { textColor: "#ffffff" } },
        { type: "action", actionId: "wheel", patch: {} },
        { type: "theme", actionId: "rightClick", patch: { sound: true } },
        null,
      ],
    })).toEqual({ leftClick: { textColor: "#ffffff" } });
    expect(hasAiPreviewForAction({
      targets: [{ type: "action", actionId: "leftClick", patch: { textColor: "#ffffff" } }],
    }, "leftClick")).toBe(true);
    expect(hasAiPreviewForAction(null, "leftClick")).toBe(false);
  });

  it("builds preview configs without mutating the current draft", () => {
    const actionConfigs = {
      leftClick: { textColor: "#000000", sound: false },
      wheel: { particle: true },
    };
    const preview = buildAiPreviewActionConfigs(actionConfigs, {
      targets: [{ type: "action", actionId: "leftClick", patch: { textColor: "#ffffff" } }],
    });

    expect(preview?.leftClick).toMatchObject({ textColor: "#ffffff", sound: false });
    expect(preview?.wheel).toBe(actionConfigs.wheel);
    expect(actionConfigs.leftClick.textColor).toBe("#000000");
  });

  it("snapshots only actions changed by the proposal", () => {
    const actionConfigs = {
      leftClick: { textColor: "#000000" },
      wheel: { particle: true },
    };
    const snapshot = createAiActionSnapshot(actionConfigs, {
      leftClick: { textColor: "#ffffff" },
    });

    expect(snapshot).toEqual({ leftClick: { textColor: "#000000" } });
    expect(snapshot.leftClick).not.toBe(actionConfigs.leftClick);
  });
});
