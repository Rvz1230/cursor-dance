import { describe, expect, it, vi } from "vitest";
import { filterWorkbenchCommands, type WorkbenchCommand } from "./WorkbenchCommandPalette";

const commands: WorkbenchCommand[] = [
  { id: "workbench", group: "工作区", label: "切到主题与效果", run: vi.fn() },
  { id: "apply", group: "编辑", label: "应用到桌面", keywords: ["保存"], run: vi.fn() },
];

describe("filterWorkbenchCommands", () => {
  it("matches labels, groups, and aliases", () => {
    expect(filterWorkbenchCommands(commands, "主题").map((item) => item.id)).toEqual(["workbench"]);
    expect(filterWorkbenchCommands(commands, "编辑").map((item) => item.id)).toEqual(["apply"]);
    expect(filterWorkbenchCommands(commands, "保存").map((item) => item.id)).toEqual(["apply"]);
  });

  it("returns all commands for an empty query", () => {
    expect(filterWorkbenchCommands(commands, "  ")).toEqual(commands);
  });
});
