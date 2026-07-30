import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKBENCH_COLUMN_WEIGHTS,
  getWorkbenchGridTemplate,
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
