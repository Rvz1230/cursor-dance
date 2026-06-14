import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// electron 在 vitest 环境无法真正加载；electron-updater 同样需要桌面运行时。
// 都做最小 stub，让 import 链路通过即可。vi.mock 工厂会被 hoist 到文件顶部，
// 所以共享 spy 必须用 vi.hoisted 在同一阶段就绪。
const { checkForUpdatesAndNotify, onListener } = vi.hoisted(() => ({
  checkForUpdatesAndNotify: vi.fn(() => Promise.resolve(null)),
  onListener: vi.fn(),
}));

vi.mock("electron", () => ({
  app: { isPackaged: false },
}));

vi.mock("electron-updater", () => ({
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    checkForUpdatesAndNotify,
    on: onListener,
  },
}));

import { registerAutoUpdater, __testing__ } from "./auto-updater";

beforeEach(() => {
  vi.useFakeTimers();
  checkForUpdatesAndNotify.mockClear();
  onListener.mockClear();
  __testing__.reset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("auto-updater", () => {
  it("dev 模式（!isPackaged）跳过 —— 不调用 checkForUpdatesAndNotify、不挂 interval", () => {
    const stop = registerAutoUpdater({ isPackaged: false });
    expect(checkForUpdatesAndNotify).not.toHaveBeenCalled();
    expect(__testing__.isRegistered()).toBe(false);
    expect(__testing__.hasInterval()).toBe(false);
    // noop stop，不应抛错
    expect(() => stop()).not.toThrow();
  });

  it("packaged 模式立即检查一次，并按 intervalMs 轮询", () => {
    registerAutoUpdater({ isPackaged: true, intervalMs: 1000 });

    expect(__testing__.isRegistered()).toBe(true);
    expect(__testing__.hasInterval()).toBe(true);
    // 启动即触发一次
    expect(checkForUpdatesAndNotify).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(checkForUpdatesAndNotify).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(2500);
    expect(checkForUpdatesAndNotify).toHaveBeenCalledTimes(4);
  });

  it("packaged 模式注册一组 updater 事件监听器", () => {
    registerAutoUpdater({ isPackaged: true, intervalMs: 1000 });
    const events = onListener.mock.calls.map((call) => call[0]);
    expect(events).toEqual(
      expect.arrayContaining([
        "error",
        "checking-for-update",
        "update-available",
        "update-not-available",
        "download-progress",
        "update-downloaded",
      ]),
    );
  });

  it("stop 清理 interval —— 后续 advanceTimers 不再触发新的 check", () => {
    const stop = registerAutoUpdater({ isPackaged: true, intervalMs: 1000 });
    expect(checkForUpdatesAndNotify).toHaveBeenCalledTimes(1);

    stop();
    expect(__testing__.hasInterval()).toBe(false);
    expect(__testing__.isRegistered()).toBe(false);

    vi.advanceTimersByTime(5000);
    expect(checkForUpdatesAndNotify).toHaveBeenCalledTimes(1);
  });

  it("重复 register 直接复用 stop（控制台警告，不再调度第二个 interval）", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    registerAutoUpdater({ isPackaged: true, intervalMs: 1000 });
    expect(checkForUpdatesAndNotify).toHaveBeenCalledTimes(1);

    registerAutoUpdater({ isPackaged: true, intervalMs: 1000 });
    expect(checkForUpdatesAndNotify).toHaveBeenCalledTimes(1); // 第二次 register 不再立即触发
    expect(warn).toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    // 仍然只有一个 interval —— 计数 +1
    expect(checkForUpdatesAndNotify).toHaveBeenCalledTimes(2);

    warn.mockRestore();
  });
});
