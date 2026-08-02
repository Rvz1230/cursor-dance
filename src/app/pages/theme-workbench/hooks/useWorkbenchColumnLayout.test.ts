import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKBENCH_COLUMN_WEIGHTS,
  getWorkbenchGridTemplate,
  normalizeWorkbenchColumnWeights,
  resizeWorkbenchColumns,
} from "./useWorkbenchColumnLayout";

describe("Workbench column layout", () => {
  it("balances config and preview widths from the drag origin", () => {
    expect(resizeWorkbenchColumns(DEFAULT_WORKBENCH_COLUMN_WEIGHTS, "config", 36)).toEqual({
      config: 1.25,
      preview: 1.05,
      ai: 1,
    });
    expect(resizeWorkbenchColumns(DEFAULT_WORKBENCH_COLUMN_WEIGHTS, "config", 360)).toEqual({
      config: 1.8,
      preview: 0.78,
      ai: 1,
    });
  });

  it("balances preview and AI widths within their limits", () => {
    expect(resizeWorkbenchColumns(DEFAULT_WORKBENCH_COLUMN_WEIGHTS, "ai", 36)).toEqual({
      config: 1.05,
      preview: 1.45,
      ai: 0.8,
    });
    expect(resizeWorkbenchColumns(DEFAULT_WORKBENCH_COLUMN_WEIGHTS, "ai", -360)).toEqual({
      config: 1.05,
      preview: 0.78,
      ai: 1.9,
    });
  });

  it("builds templates with and without the AI column", () => {
    expect(getWorkbenchGridTemplate(DEFAULT_WORKBENCH_COLUMN_WEIGHTS, false)).toBe(
      "minmax(0,1.05fr) 4px minmax(0,1.25fr)",
    );
    expect(getWorkbenchGridTemplate(DEFAULT_WORKBENCH_COLUMN_WEIGHTS, true)).toBe(
      "minmax(0,1.05fr) 4px minmax(0,1.25fr) 4px minmax(0,1fr)",
    );
  });
});

// 持久化的偏好是外部输入，必须当不可信数据处理。
describe("normalizeWorkbenchColumnWeights", () => {
  it("keeps a valid persisted layout", () => {
    const stored = { config: 1.4, preview: 0.9, ai: 1.1 };
    expect(normalizeWorkbenchColumnWeights(stored)).toEqual(stored);
  });

  it("clamps values that fall outside the layout bounds", () => {
    expect(normalizeWorkbenchColumnWeights({ config: 99, preview: -3, ai: 0 })).toEqual({
      config: 1.8,
      preview: 0.78,
      ai: 0.8,
    });
  });

  it("falls back to defaults for malformed or partial input", () => {
    for (const bad of [null, undefined, "1.2", [], {}, { config: 1.2, preview: 1 }, { config: Number.NaN, preview: 1, ai: 1 }]) {
      expect(normalizeWorkbenchColumnWeights(bad)).toEqual(DEFAULT_WORKBENCH_COLUMN_WEIGHTS);
    }
  });
});
