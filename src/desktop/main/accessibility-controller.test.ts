import { describe, expect, it, vi } from "vitest";
import { createAccessibilityController } from "./accessibility-controller";

describe("accessibility controller", () => {
  it("未授权时不启动监听，请求授权使用系统 prompt", async () => {
    const isTrusted = vi.fn(() => false);
    const startCapture = vi.fn(async () => vi.fn());
    const controller = createAccessibilityController({
      platform: "darwin",
      isTrusted,
      startCapture,
    });

    await expect(controller.refresh()).resolves.toEqual({ status: "required" });
    await expect(controller.requestAccess()).resolves.toEqual({ status: "required" });
    expect(isTrusted).toHaveBeenNthCalledWith(1, false);
    expect(isTrusted).toHaveBeenNthCalledWith(2, true);
    expect(startCapture).not.toHaveBeenCalled();
  });

  it("授权后自动启动一次，重复刷新不会重复注册监听", async () => {
    let trusted = false;
    const stopCapture = vi.fn();
    const startCapture = vi.fn(async () => stopCapture);
    const controller = createAccessibilityController({
      platform: "darwin",
      isTrusted: () => trusted,
      startCapture,
    });

    await controller.refresh();
    trusted = true;
    await controller.refresh();
    await controller.refresh();

    expect(controller.getState()).toEqual({ status: "running" });
    expect(startCapture).toHaveBeenCalledTimes(1);
    expect(stopCapture).not.toHaveBeenCalled();
  });

  it("并发刷新只共享一个启动任务", async () => {
    let resolveStart: ((stop: () => void) => void) | undefined;
    const startCapture = vi.fn(() => new Promise<() => void>((resolve) => {
      resolveStart = resolve;
    }));
    const controller = createAccessibilityController({
      platform: "darwin",
      isTrusted: () => true,
      startCapture,
    });

    const first = controller.refresh();
    const second = controller.refresh();
    expect(startCapture).toHaveBeenCalledTimes(1);
    resolveStart?.(() => undefined);
    await Promise.all([first, second]);
    expect(controller.getState()).toEqual({ status: "running" });
  });

  it("权限被撤销时停止监听，并能在重新授权后恢复", async () => {
    let trusted = true;
    const stops: Array<ReturnType<typeof vi.fn>> = [];
    const startCapture = vi.fn(async () => {
      const stop = vi.fn();
      stops.push(stop);
      return stop;
    });
    const controller = createAccessibilityController({
      platform: "darwin",
      isTrusted: () => trusted,
      startCapture,
    });

    await controller.refresh();
    trusted = false;
    await controller.refresh();
    expect(stops[0]).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toEqual({ status: "required" });

    trusted = true;
    await controller.refresh();
    expect(startCapture).toHaveBeenCalledTimes(2);
    expect(controller.getState()).toEqual({ status: "running" });
  });

  it("原生监听启动失败后保留错误，并允许下一次刷新重试", async () => {
    const startCapture = vi.fn()
      .mockRejectedValueOnce(new Error("native module failed"))
      .mockResolvedValueOnce(() => undefined);
    const controller = createAccessibilityController({
      platform: "darwin",
      isTrusted: () => true,
      startCapture,
    });

    await expect(controller.refresh()).resolves.toEqual({
      status: "error",
      message: "native module failed",
    });
    await expect(controller.refresh()).resolves.toEqual({ status: "running" });
    expect(startCapture).toHaveBeenCalledTimes(2);
  });

  it("非 macOS 不查询 TCC，监听成功后标记为不适用", async () => {
    const isTrusted = vi.fn(() => false);
    const controller = createAccessibilityController({
      platform: "win32",
      isTrusted,
      startCapture: async () => () => undefined,
    });

    await expect(controller.refresh()).resolves.toEqual({ status: "unsupported" });
    expect(isTrusted).not.toHaveBeenCalled();
  });
});
