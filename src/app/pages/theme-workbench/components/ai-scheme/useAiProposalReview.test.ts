import { describe, expect, it } from "vitest";
import { describeAiProposalApplication } from "./useAiProposalReview";

describe("describeAiProposalApplication", () => {
  it("summarizes proposals that update multiple actions", () => {
    expect(describeAiProposalApplication({ targets: [{}, {}, {}] })).toBe("已更新 3 个动作。");
  });

  it("uses the first diff summary for a single action", () => {
    expect(describeAiProposalApplication({ diffSummary: ["粒子数量：30 → 12", "关闭声音"] }))
      .toBe("粒子数量：30 → 12");
  });

  it("falls back when the proposal has no readable summary", () => {
    expect(describeAiProposalApplication({})).toBe("配置已更新，可在预览区查看效果。");
  });
});
