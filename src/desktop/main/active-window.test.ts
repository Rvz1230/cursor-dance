// active-window IPC 单元测试
//
// 验证两件事：
//   1. native 调用失败时收敛为 authorized: false。
//   2. macOS 只读取 owner / Bundle ID，不申请窗口标题所需权限。
//
// get-windows 整包 mock 掉，避免 vitest 环境里 require native binary。

import { describe, it, expect, vi, beforeEach } from "vitest";

const activeWindowSyncMock = vi.fn();

vi.mock("get-windows", () => ({
  activeWindowSync: (...args: unknown[]) => activeWindowSyncMock(...args),
}));

// electron 在 vitest 环境不可用——只测 getActiveWindowSnapshot（纯函数路径），
// IPC 注册不在本文件覆盖（registerActiveWindowIpc 走 ipcMain.handle，
// 已由 electron-store.test 等同形态覆盖过）。
vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
}));

import { createActiveWindowMonitor, getActiveWindowSnapshot } from "./active-window";
import type { ActiveWindowSnapshot } from "../../shared/app-rules";

describe("getActiveWindowSnapshot", () => {
  beforeEach(() => {
    activeWindowSyncMock.mockReset();
  });

  it("native 调用失败：返回不可用快照", () => {
    activeWindowSyncMock.mockImplementation(() => {
      throw new Error(
        "Command failed: get-windows requires the accessibility permission in System Settings › Privacy & Security › Accessibility.",
      );
    });
    const snap = getActiveWindowSnapshot();
    expect(snap.authorized).toBe(false);
    if (!snap.authorized) {
      expect(typeof ("message" in snap ? snap.message : "")).toBe("string");
    }
  });

  it("activeWindowSync 返回 undefined → unauthorized", () => {
    activeWindowSyncMock.mockReturnValue(undefined);
    const snap = getActiveWindowSnapshot();
    expect(snap.authorized).toBe(false);
  });

  it("正常 macOS Result → 抽出 owner.name / bundleId，标题明确置空", () => {
    activeWindowSyncMock.mockReturnValue({
      platform: "macos",
      title: "index.ts — cursor-dance",
      id: 123,
      bounds: { x: 0, y: 0, width: 1280, height: 800 },
      memoryUsage: 0,
      owner: {
        name: "Code",
        processId: 999,
        path: "/Applications/Visual Studio Code.app",
        bundleId: "com.microsoft.VSCode",
      },
    });
    const snap = getActiveWindowSnapshot();
    expect(snap.authorized).toBe(true);
    if (snap.authorized) {
      expect(snap.owner.name).toBe("Code");
      expect(snap.owner.bundleId).toBe("com.microsoft.VSCode");
      expect(snap.title).toBe("");
      expect(snap.processName).toBe("Code");
      expect(snap.bounds).toEqual({ x: 0, y: 0, width: 1280, height: 800 });
    }
    expect(activeWindowSyncMock).toHaveBeenCalledWith({
      accessibilityPermission: false,
      screenRecordingPermission: false,
    });
  });

  it("非 macOS Result：bundleId 缺省 undefined，processName 仍取 owner.name", () => {
    activeWindowSyncMock.mockReturnValue({
      platform: "linux",
      title: "Terminal",
      id: 1,
      bounds: { x: 0, y: 0, width: 800, height: 600 },
      memoryUsage: 0,
      owner: {
        name: "gnome-terminal-",
        processId: 4242,
        path: "/usr/bin/gnome-terminal",
      },
    });
    const snap = getActiveWindowSnapshot();
    expect(snap.authorized).toBe(true);
    if (snap.authorized) {
      expect(snap.owner.bundleId).toBeUndefined();
      expect(snap.processName).toBe("gnome-terminal-");
    }
  });

  it("title 缺省 → 空串而非 undefined（与 ActiveAppInfo 契约一致）", () => {
    activeWindowSyncMock.mockReturnValue({
      platform: "macos",
      title: undefined as unknown as string,
      id: 1,
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      memoryUsage: 0,
      owner: { name: "X", processId: 1, path: "/", bundleId: "x" },
    });
    const snap = getActiveWindowSnapshot();
    expect(snap.authorized).toBe(true);
    if (snap.authorized) expect(snap.title).toBe("");
  });
});

describe("createActiveWindowMonitor", () => {
  const codeSnapshot: ActiveWindowSnapshot = {
    authorized: true,
    owner: { name: "Code", bundleId: "com.microsoft.VSCode" },
    processName: "Code",
    title: "app.ts — cursor-dance",
  };
  const workbenchSnapshot: ActiveWindowSnapshot = {
    authorized: true,
    owner: { name: "CursorDance", bundleId: "com.cursordance.app" },
    processName: "CursorDance",
    title: "CursorDance 工作台",
  };

  it("只在有效快照变化时广播", () => {
    let next = codeSnapshot;
    const published: ActiveWindowSnapshot[] = [];
    const monitor = createActiveWindowMonitor({
      readSnapshot: () => next,
      publish: (snapshot) => published.push(snapshot),
    });

    monitor.poll();
    monitor.poll();
    next = { ...codeSnapshot, title: "README.md — cursor-dance" };
    monitor.poll();

    expect(published).toHaveLength(2);
    expect(published[1]).toMatchObject({ title: "README.md — cursor-dance" });
  });

  it("Workbench 成为前台时保留最近的非 CursorDance 应用", () => {
    let next = codeSnapshot;
    const published: ActiveWindowSnapshot[] = [];
    const monitor = createActiveWindowMonitor({
      readSnapshot: () => next,
      publish: (snapshot) => published.push(snapshot),
    });

    expect(monitor.poll()).toEqual(codeSnapshot);
    next = workbenchSnapshot;
    expect(monitor.poll()).toEqual(codeSnapshot);
    expect(published).toEqual([codeSnapshot]);
  });

  it("未授权状态会覆盖缓存并向 renderer 广播", () => {
    let next: ActiveWindowSnapshot = codeSnapshot;
    const published: ActiveWindowSnapshot[] = [];
    const monitor = createActiveWindowMonitor({
      readSnapshot: () => next,
      publish: (snapshot) => published.push(snapshot),
    });

    monitor.poll();
    next = { authorized: false, message: "需要辅助功能权限" };
    expect(monitor.poll()).toEqual(next);
    expect(published).toHaveLength(2);
  });
});
