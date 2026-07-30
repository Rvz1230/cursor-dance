import { describe, expect, it, vi } from "vitest";
import { defaultConfig } from "../config/default-config";
import type { ContextRuleActionV4 } from "../config-schema-v4";
import { createRuntimeConfigCore } from "./runtime-config";

class FakeElement {
  constructor(
    readonly cursor: string,
    private readonly matchingSelectors: readonly string[] = [],
  ) {}

  closest(selector: string): FakeElement | null {
    return this.matchingSelectors.includes(selector) ? this : null;
  }
}

function createCore(action: ContextRuleActionV4 | null = null, diagnostics?: {
  log(scope: string, payload?: Record<string, unknown>): void;
  describeTarget(target: unknown): unknown;
}) {
  const window = {
    Element: FakeElement,
    getComputedStyle: (target: FakeElement) => ({ cursor: target.cursor }),
  } as unknown as Window;
  return createRuntimeConfigCore({
    window,
    getConfig: () => defaultConfig,
    resolveContextAction: () => action,
    interactiveSelector: "a,button",
    textEditableSelector: "input,textarea",
    diagnostics,
  });
}

describe("runtime config core", () => {
  it("selects the context theme and enablement state", () => {
    expect(createCore({ type: "enable", themeId: "drift" }).getActiveTheme().id).toBe("drift");
    expect(createCore({ type: "disable" }).isCurrentContextEnabled()).toBe(false);
  });

  it("merges theme action values without mutating shared defaults", () => {
    const core = createCore();
    const theme = {
      ...defaultConfig.themes[0],
      actionConfigs: {
        ...defaultConfig.themes[0].actionConfigs,
        leftClick: { textContent: "custom", textTags: ["one", "two"] },
      },
    };
    const first = core.getActionConfig(theme, "leftClick");
    const second = core.getActionConfig(theme, "leftClick");

    expect(first).toMatchObject(theme.actionConfigs.leftClick);
    expect(first?.textTags).not.toBe(second?.textTags);
    expect(core.getCursorStateBinding(theme, "pointer", "leftClick")).toMatchObject({
      cursorStateId: "pointer",
      inheritedFromDefault: true,
    });
  });

  it("shares DOM cursor and trigger-zone resolution with diagnostics", () => {
    const diagnostics = {
      log: vi.fn<(scope: string, payload?: Record<string, unknown>) => void>(),
      describeTarget: vi.fn<(target: unknown) => unknown>(() => "button"),
    };
    const core = createCore(null, diagnostics);
    const button = new FakeElement("auto", ["a,button", "a,button,[role='button']"]);
    const hiddenCursorButton = new FakeElement("none", ["a,button"]);

    expect(core.resolveCursorStateId(button)).toBe("pointer");
    expect(core.resolveCursorStateId(hiddenCursorButton)).toBe("default");
    expect(core.matchesTriggerZone(button, "按钮和链接", { pointerType: "mouse" }, {
      actionId: "leftClick",
      triggerSource: "pointer",
    })).toBe(true);
    expect(diagnostics.log).toHaveBeenCalledWith("trigger-zone.check", expect.objectContaining({
      matched: true,
      target: "button",
    }));
  });
});
