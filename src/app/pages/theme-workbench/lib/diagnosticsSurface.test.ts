import { describe, expect, it } from "vitest";
import { appendDiagnosticEntry, summarizeLivePreviewConfig } from "./diagnosticsSurface";

describe("diagnosticsSurface", () => {
  it("keeps only the most recent diagnostic entries", () => {
    const entries = Array.from({ length: 5 }, (_, index) => ({ scope: `event-${index + 1}` }));
    const nextEntries = appendDiagnosticEntry(entries.slice(0, 4), entries[4], 3);

    expect(nextEntries).toEqual([{ scope: "event-3" }, { scope: "event-4" }, { scope: "event-5" }]);
  });

  it("describes live preview state for current and absent themes", () => {
    expect(summarizeLivePreviewConfig(null, "woodfish")).toMatchObject({
      status: "inactive",
      activeThemeId: "",
    });

    expect(
      summarizeLivePreviewConfig(
        {
          activeThemePackId: "woodfish",
          themePacks: [{ id: "woodfish" }],
        },
        "woodfish"
      )
    ).toMatchObject({
      status: "current",
      activeThemeId: "woodfish",
      themeCount: 1,
    });
  });
});
