// 前台应用元数据 IPC
//
// 用 get-windows 取当前 active window 的进程名 / Bundle ID / 窗口标题，
// 投递给 renderer 的共享 app-rules 匹配器做应用规则匹配。
//
// 设计要点：
//   1. **同步路径优先**：activeWindowSync 在 macOS / Windows / Linux 上都比异步 PoC 便宜
//      （没有 microtask/promise 调度），适合 ~10Hz 轮询场景；调用方仍按 Promise 取值
//      以便未来切换到 activeWindow() 不破坏 IPC 契约。
//   2. **最小权限**：macOS 首版不为应用规则申请辅助功能或屏幕录制权限。
//      owner.name / bundleId 足以支持应用级规则；窗口标题读取明确作为未支持能力。
//   3. **失败安静返回**：当前没有 active window（例如锁屏）或 native 调用失败时，
//      返回 { authorized: false, ... } 作为“元数据暂不可用”，不误导成权限问题。
//
// 输出形态与 shared/app-rules 的 ActiveAppInfo 一致 + 额外字段：
//   { authorized: true, owner: { name, bundleId? }, title: string, processName }
//   { authorized: false, message: string }

import { ipcMain } from "electron";
import { activeWindowSync, type Result as ActiveWindowResult } from "get-windows";
import { APP_GET_ACTIVE_WINDOW } from "../../shared/ipc-channels";
import { assertIpcSender } from "./ipc-security";
import type { ActiveWindowSnapshot } from "../../shared/app-rules";

export type { ActiveWindowSnapshot } from "../../shared/app-rules";

/**
 * 取当前前台窗口元数据。permission 失败 / 没有窗口 / 调用抛错 都收敛为
 * `{ authorized: false, message }`，调用方按显示态处理。
 */
export function getActiveWindowSnapshot(): ActiveWindowSnapshot {
  try {
    const result = activeWindowSync({
      accessibilityPermission: false,
      screenRecordingPermission: false,
    }) as ActiveWindowResult | undefined;

    if (!result) {
      return {
        authorized: false,
        message: "暂时无法获取当前前台应用。",
      };
    }

    const owner = result.owner;
    const bundleId =
      result.platform === "macos" && typeof (owner as { bundleId?: unknown }).bundleId === "string"
        ? (owner as { bundleId: string }).bundleId
        : undefined;

    return {
      authorized: true,
      owner: { name: owner.name, bundleId },
      // get-windows 在 macOS 关闭 Screen Recording 后不保证 title；契约上直接置空，
      // 避免历史缓存或实现差异让标题规则看似偶尔可用。
      title: result.platform === "macos" ? "" : result.title || "",
      processName: owner.name,
      bounds: result.bounds,
    };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    const message = raw || "暂时无法获取当前前台应用。";
    return { authorized: false, message };
  }
}

function snapshotsEqual(left: ActiveWindowSnapshot | null, right: ActiveWindowSnapshot): boolean {
  if (!left || left.authorized !== right.authorized) return false;
  if (!left.authorized || !right.authorized) {
    return "message" in left && "message" in right && left.message === right.message;
  }
  return left.processName === right.processName
    && left.title === right.title
    && left.owner.bundleId === right.owner.bundleId
    && left.bounds?.x === right.bounds?.x
    && left.bounds?.y === right.bounds?.y
    && left.bounds?.width === right.bounds?.width
    && left.bounds?.height === right.bounds?.height
    && left.elementAccessAvailable === right.elementAccessAvailable;
}

function isCursorDanceWindow(snapshot: ActiveWindowSnapshot): boolean {
  if (!snapshot.authorized) return false;
  const bundleId = snapshot.owner.bundleId?.toLowerCase();
  const processName = snapshot.processName.trim().toLowerCase();
  return bundleId === "com.cursordance.app"
    || processName === "cursordance"
    || processName === "cursor-dance"
    || /cursordance 工作台/i.test(snapshot.title);
}

export interface ActiveWindowMonitor {
  poll(): ActiveWindowSnapshot;
  getCurrent(): ActiveWindowSnapshot;
  start(): () => void;
}

export function createActiveWindowMonitor({
  readSnapshot = getActiveWindowSnapshot,
  publish,
  intervalMs = 250,
}: {
  readSnapshot?: () => ActiveWindowSnapshot;
  publish: (snapshot: ActiveWindowSnapshot) => void;
  intervalMs?: number;
}): ActiveWindowMonitor {
  let current: ActiveWindowSnapshot | null = null;
  let lastNonCursorDance: ActiveWindowSnapshot | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  function poll(): ActiveWindowSnapshot {
    const observed = readSnapshot();
    let effective = observed;
    if (observed.authorized) {
      if (isCursorDanceWindow(observed) && lastNonCursorDance?.authorized) {
        effective = lastNonCursorDance;
      } else if (!isCursorDanceWindow(observed)) {
        lastNonCursorDance = observed;
      }
    }

    if (!snapshotsEqual(current, effective)) {
      current = effective;
      publish(effective);
    }
    return effective;
  }

  function getCurrent(): ActiveWindowSnapshot {
    return current || poll();
  }

  function start(): () => void {
    if (timer) return () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    poll();
    timer = setInterval(poll, intervalMs);
    return () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
  }

  return { poll, getCurrent, start };
}

export function registerActiveWindowIpc(getSnapshot: () => ActiveWindowSnapshot = getActiveWindowSnapshot): void {
  ipcMain.handle(APP_GET_ACTIVE_WINDOW, (event) => {
    assertIpcSender(event, APP_GET_ACTIVE_WINDOW);
    return getSnapshot();
  });
}

export function unregisterActiveWindowIpc(): void {
  ipcMain.removeHandler(APP_GET_ACTIVE_WINDOW);
}
