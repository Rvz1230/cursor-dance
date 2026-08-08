import { describe, expect, it } from "vitest";
import { createAdvancedRuleDraft, validateAdvancedRuleDraft } from "./AdvancedRulesSection";

describe("advanced rule platform capability", () => {
  it("creates process rules by default", () => {
    expect(createAdvancedRuleDraft().pattern.target).toBe("process");
  });

  it("preserves but rejects unsupported historical title rules", () => {
    const draft = createAdvancedRuleDraft();
    draft.pattern = { type: "glob", target: "title", value: "*Review*" };

    expect(validateAdvancedRuleDraft(draft, false)).toMatch(/不支持窗口标题规则/);
    expect(validateAdvancedRuleDraft(draft, true)).toBeNull();
  });
});
