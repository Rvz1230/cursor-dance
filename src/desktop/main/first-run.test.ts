import { describe, it, expect, beforeEach, vi } from "vitest";

// 同 electron-store.test.ts —— stub 掉 electron-store 与 electron 这两个 native 依赖。
vi.mock("electron-store", () => ({
  default: class {
    private data = new Map<string, unknown>();
    get(key: string, fallback?: unknown) {
      return this.data.has(key) ? this.data.get(key) : fallback;
    }
    set(key: string, value: unknown) {
      this.data.set(key, value);
    }
  },
}));

// vi.mock 工厂会被 hoist 到文件顶部，闭包外的变量都不可用 ——
// 用 vi.hoisted 注册 spy，再在工厂里引用才能保留 mock 引用。
const electronMock = vi.hoisted(() => ({
  openExternalSpy: vi.fn(async (_target: string) => undefined),
}));

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
  shell: {
    openExternal: electronMock.openExternalSpy,
  },
}));

import {
  isFirstRun,
  markFirstRunComplete,
  openExternalSafe,
  __testing__,
} from "./first-run";

beforeEach(() => {
  __testing__.reset();
  electronMock.openExternalSpy.mockClear();
});

describe("first-run", () => {
  it("isFirstRun 默认为 true（key 不存在）", () => {
    expect(isFirstRun()).toBe(true);
  });

  it("markFirstRunComplete 之后 isFirstRun 永久为 false", () => {
    expect(isFirstRun()).toBe(true);
    markFirstRunComplete();
    expect(isFirstRun()).toBe(false);
    // 再调一次 mark 也不会回到 true
    markFirstRunComplete();
    expect(isFirstRun()).toBe(false);
  });
});

describe("openExternalSafe", () => {
  it("https 链接放行", async () => {
    const result = await openExternalSafe("https://example.com");
    expect(result.ok).toBe(true);
    expect(electronMock.openExternalSpy).toHaveBeenCalledWith("https://example.com");
  });

  it("x-apple.systempreferences scheme 放行（macOS 系统设置跳转）", async () => {
    const target = "x-apple.systempreferences:com.apple.preference.security";
    const result = await openExternalSafe(target);
    expect(result.ok).toBe(true);
    expect(electronMock.openExternalSpy).toHaveBeenCalledWith(target);
  });

  it("拒绝 file:// 这类危险 scheme", async () => {
    const result = await openExternalSafe("file:///etc/passwd");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/protocol not allowed/);
    expect(electronMock.openExternalSpy).not.toHaveBeenCalled();
  });

  it("非 URL 输入返回 error", async () => {
    const result = await openExternalSafe("not a url");
    expect(result.ok).toBe(false);
    expect(electronMock.openExternalSpy).not.toHaveBeenCalled();
  });
});
