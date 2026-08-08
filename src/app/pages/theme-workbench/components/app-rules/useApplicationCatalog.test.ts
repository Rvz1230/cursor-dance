import { describe, expect, it } from "vitest";
import {
  combineApplicationCatalog,
  mergeApplicationMetadata,
} from "./useApplicationCatalog";

const recent = {
  key: "code",
  name: "Visual Studio Code",
  processName: "Code",
  title: "cursor-dance",
};

const installed = {
  key: "com.microsoft.vscode",
  name: "Code",
  processName: "code",
  title: "",
  bundleId: "com.microsoft.VSCode",
  iconDataUrl: "data:image/png;base64,icon",
};

describe("mergeApplicationMetadata", () => {
  it("enriches a recent application with installed metadata without replacing live fields", () => {
    expect(mergeApplicationMetadata(recent, [installed])).toEqual({
      ...recent,
      bundleId: "com.microsoft.VSCode",
      iconDataUrl: "data:image/png;base64,icon",
    });
  });
});

describe("combineApplicationCatalog", () => {
  it("deduplicates installed applications by process name without collapsing distinct processes", () => {
    const helper = {
      ...installed,
      key: "com.microsoft.vscode-helper",
      processName: "Code Helper",
    };

    expect(combineApplicationCatalog(
      [{ ...recent, bundleId: installed.bundleId }],
      [installed, helper],
    )).toEqual([
      { ...recent, bundleId: installed.bundleId },
      helper,
    ]);
  });
});
