import { describe, expect, it } from "vitest";
import type { ActiveWindowSnapshot, AppRule } from "@/shared/app-rules";
import {
  applicationFromSnapshot,
  applicationPattern,
  applicationRuleMatchesCandidate,
  isApplicationRule,
  rememberApplication,
  resolveAppRuleDecision,
  resolveRuleMatchStates,
} from "./appRulesModel";

const figma: ActiveWindowSnapshot = {
  authorized: true,
  owner: { name: "Figma", bundleId: "com.figma.Desktop" },
  processName: "Figma",
  title: "季度复盘 — 演示模式",
};

const rules: AppRule[] = [{
  id: "title",
  pattern: { target: "title", type: "glob", value: "*演示模式*" },
  action: "disable",
  enabled: true,
}, {
  id: "app",
  pattern: { target: "process", type: "exact", value: "Figma" },
  action: { enable: true, theme: "drift" },
  enabled: true,
}];

describe("application rules presentation model", () => {
  it("turns an authorized snapshot into an application-first candidate", () => {
    expect(applicationFromSnapshot(figma)).toEqual({
      key: "com.figma.desktop",
      name: "Figma",
      processName: "Figma",
      title: "季度复盘 — 演示模式",
      bundleId: "com.figma.Desktop",
    });
    expect(applicationFromSnapshot({ authorized: false, message: "denied" })).toBeNull();
  });

  it("keeps recent applications deduplicated with the latest first", () => {
    const first = rememberApplication([], figma);
    const updated = rememberApplication(first, { ...figma, title: "新的窗口" });
    expect(updated).toHaveLength(1);
    expect(updated[0].title).toBe("新的窗口");
  });

  it("separates application rows from advanced match rules", () => {
    expect(isApplicationRule(rules[0])).toBe(false);
    expect(isApplicationRule(rules[1])).toBe(true);
    expect(isApplicationRule({
      ...rules[1],
      id: "advanced-exact",
      kind: "advanced",
    })).toBe(false);
  });

  it("uses bundle ids for application rules and falls back to process names", () => {
    const application = applicationFromSnapshot(figma)!;
    expect(applicationPattern(application)).toEqual({
      target: "bundle",
      type: "exact",
      value: "com.figma.Desktop",
    });
    expect(applicationRuleMatchesCandidate({
      id: "bundle",
      kind: "application",
      pattern: applicationPattern(application),
      action: "disable",
    }, application)).toBe(true);
    expect(applicationPattern({ ...application, bundleId: undefined })).toEqual({
      target: "process",
      type: "exact",
      value: "Figma",
    });
  });

  it("prioritizes application rows before ordered advanced rules", () => {
    const info = { processName: "Figma", title: "季度复盘 — 演示模式" };
    expect(resolveRuleMatchStates(rules, info, true)).toEqual(new Map([
      ["app", "active"],
      ["title", "shadowed"],
    ]));
    expect(resolveAppRuleDecision(rules, figma, true)).toEqual({
      enabled: true,
      action: { enable: true, theme: "drift" },
      ruleId: "app",
    });
  });

  it("lets empty actions fall through to the next decision layer", () => {
    const emptyApplicationRule: AppRule = {
      ...rules[1],
      action: { enable: true },
    };
    expect(resolveAppRuleDecision([rules[0], emptyApplicationRule], figma, true)).toEqual({
      enabled: false,
      action: "disable",
      ruleId: "title",
    });
    expect(resolveAppRuleDecision([{ ...rules[0], action: { enable: true } }, { ...emptyApplicationRule, action: "disable" }], figma, false)).toEqual({
      enabled: true,
      action: { enable: true },
      ruleId: "title",
    });
    expect(resolveAppRuleDecision([
      { ...rules[1], action: { enable: false, theme: "drift" } },
      rules[0],
    ], figma, true)).toEqual({
      enabled: false,
      action: "disable",
      ruleId: "title",
    });
  });

  it("falls back to the global behavior when nothing matches", () => {
    expect(resolveAppRuleDecision([], figma, false)).toEqual({
      enabled: false,
      action: null,
      ruleId: null,
    });
  });
});
