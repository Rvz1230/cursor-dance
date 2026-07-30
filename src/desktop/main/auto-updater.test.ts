import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const listeners = new Map<string, (payload?: unknown) => void>();
  const checkForUpdates = vi.fn(() => Promise.resolve(null));
  const downloadUpdate = vi.fn(() => Promise.resolve([]));
  const quitAndInstall = vi.fn();
  const on = vi.fn((event: string, listener: (payload?: unknown) => void) => {
    listeners.set(event, listener);
  });
  const off = vi.fn((event: string, listener: (payload?: unknown) => void) => {
    if (listeners.get(event) === listener) listeners.delete(event);
  });
  return {
    listeners,
    checkForUpdates,
    downloadUpdate,
    quitAndInstall,
    on,
    off,
    updater: {
      autoDownload: true,
      autoInstallOnAppQuit: true,
      checkForUpdates,
      downloadUpdate,
      quitAndInstall,
      on,
      off,
    },
  };
});

vi.mock("electron", () => ({ app: { isPackaged: false } }));
vi.mock("electron-updater", () => ({ default: { autoUpdater: mocks.updater } }));

import { __testing__, registerAutoUpdater } from "./auto-updater";

function emit(event: string, payload?: unknown): void {
  const listener = mocks.listeners.get(event);
  if (!listener) throw new Error(`No listener registered for ${event}`);
  listener(payload);
}

beforeEach(() => {
  vi.useFakeTimers();
  __testing__.reset();
  mocks.listeners.clear();
  mocks.checkForUpdates.mockReset().mockResolvedValue(null);
  mocks.downloadUpdate.mockReset().mockResolvedValue([]);
  mocks.quitAndInstall.mockReset();
  mocks.on.mockClear();
  mocks.off.mockClear();
  mocks.updater.autoDownload = true;
  mocks.updater.autoInstallOnAppQuit = true;
});

afterEach(() => {
  __testing__.reset();
  vi.useRealTimers();
});

describe("auto-updater", () => {
  it("开发态返回 unsupported，不注册监听或网络任务", () => {
    const controller = registerAutoUpdater({ isPackaged: false });
    expect(controller.getState()).toEqual({ status: "unsupported" });
    expect(mocks.checkForUpdates).not.toHaveBeenCalled();
    expect(mocks.on).not.toHaveBeenCalled();
    expect(__testing__.isRegistered()).toBe(false);
    expect(__testing__.hasInterval()).toBe(false);
  });

  it("打包态关闭静默下载与退出自动安装，并按间隔检查", async () => {
    const controller = registerAutoUpdater({ isPackaged: true, intervalMs: 1000 });
    await controller.checkForUpdates();

    expect(mocks.updater.autoDownload).toBe(false);
    expect(mocks.updater.autoInstallOnAppQuit).toBe(false);
    expect(mocks.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(__testing__.hasInterval()).toBe(true);

    await vi.advanceTimersByTimeAsync(2500);
    expect(mocks.checkForUpdates).toHaveBeenCalledTimes(3);
  });

  it("将 updater 事件转换为可广播的状态机", () => {
    const published = vi.fn();
    const controller = registerAutoUpdater({ isPackaged: true, publish: published });

    emit("update-available", { version: "0.7.0" });
    expect(controller.getState()).toMatchObject({ status: "available", version: "0.7.0" });

    emit("download-progress", { percent: 42.4 });
    expect(controller.getState()).toEqual({ status: "downloading", version: "0.7.0", percent: 42 });

    emit("update-downloaded", { version: "0.7.0" });
    expect(controller.getState()).toEqual({ status: "downloaded", version: "0.7.0" });
    expect(published).toHaveBeenCalledWith({ status: "downloaded", version: "0.7.0" });
  });

  it("只有发现更新后才允许下载，下载完成后才允许重启安装", async () => {
    const controller = registerAutoUpdater({ isPackaged: true });
    await expect(controller.downloadUpdate()).resolves.toMatchObject({ status: "checking" });
    expect(mocks.downloadUpdate).not.toHaveBeenCalled();

    emit("update-available", { version: "0.7.0" });
    await expect(controller.downloadUpdate()).resolves.toEqual({ status: "downloaded", version: "0.7.0" });
    expect(mocks.downloadUpdate).toHaveBeenCalledTimes(1);

    controller.installUpdate();
    expect(mocks.quitAndInstall).toHaveBeenCalledWith(false, true);
  });

  it("下载中或等待重启时，定时检查不会覆盖用户可见状态", async () => {
    const controller = registerAutoUpdater({ isPackaged: true, intervalMs: 1000 });
    await controller.checkForUpdates();
    emit("update-available", { version: "0.7.0" });
    emit("update-downloaded", { version: "0.7.0" });

    await vi.advanceTimersByTimeAsync(5000);
    expect(mocks.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toEqual({ status: "downloaded", version: "0.7.0" });
  });

  it("检查失败被转换为 error 状态，不向应用生命周期抛出", async () => {
    mocks.checkForUpdates.mockRejectedValueOnce(new Error("network unavailable"));
    const controller = registerAutoUpdater({ isPackaged: true });

    await expect(controller.checkForUpdates()).resolves.toEqual({
      status: "error",
      message: "network unavailable",
    });
  });

  it("stop 清理 interval 和全部 updater listener", async () => {
    const controller = registerAutoUpdater({ isPackaged: true, intervalMs: 1000 });
    await controller.checkForUpdates();
    expect(mocks.listeners.size).toBe(6);

    controller.stop();
    expect(__testing__.hasInterval()).toBe(false);
    expect(__testing__.isRegistered()).toBe(false);
    expect(mocks.listeners.size).toBe(0);
    expect(mocks.off).toHaveBeenCalledTimes(6);

    await vi.advanceTimersByTimeAsync(5000);
    expect(mocks.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it("重复 register 复用同一 controller，不创建第二组任务", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const first = registerAutoUpdater({ isPackaged: true, intervalMs: 1000 });
    const second = registerAutoUpdater({ isPackaged: true, intervalMs: 1000 });

    expect(second).toBe(first);
    expect(mocks.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(mocks.on).toHaveBeenCalledTimes(6);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
