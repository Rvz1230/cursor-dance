// 任务 3.2：前台应用元数据 IPC
//
// 用 get-windows 取当前 active window 的进程名 / Bundle ID / 窗口标题，
// 投递给 renderer 的 app-matcher（src/renderer/engine/app-matcher.ts）做应用规则匹配。
//
// 设计要点：
//   1. **同步路径优先**：activeWindowSync 在 macOS / Windows / Linux 上都比异步 PoC 便宜
//      （没有 microtask/promise 调度），适合 ~10Hz 轮询场景；调用方仍按 Promise 取值
//      以便未来切换到 activeWindow() 不破坏 IPC 契约。
//   2. **macOS 权限失败安静返回**：`activeWindowSync` 在没有辅助功能 + 屏幕录制权限时
//      会同步抛 native 错。捕获后返回 { authorized: false, ... }，不上报；
//      调用方（应用规则面板）拿到这个状态后引导用户去系统设置授权。
//   3. **关闭权限提示对话框**：默认 get-windows 会触发 macOS 系统弹窗（一次性）。
//      但桌面端首次启动时我们不希望立刻弹——把 screenRecordingPermission 关掉，
//      只保留 accessibilityPermission（标题字段才是规则匹配的核心）。
//
// 输出形态与 app-matcher 的 ActiveAppInfo 一致 + 额外字段：
//   { authorized: true, owner: { name, bundleId? }, title: string, processName }
//   { authorized: false, message: string }

import { ipcMain } from "electron";
import { activeWindowSync, type Result as ActiveWindowResult } from "get-windows";
import { APP_GET_ACTIVE_WINDOW } from "../shared/ipc-channels";

export interface ActiveWindowOwner {
  /** 进程显示名（macOS: app 名，Windows: 进程名 + 扩展，Linux: WM_CLASS） */
  name: string;
  /** macOS Bundle Identifier，其它平台为 undefined */
  bundleId?: string;
}

export type ActiveWindowSnapshot =
  | {
      authorized: true;
      owner: ActiveWindowOwner;
      title: string;
      /** 与 app-matcher.ActiveAppInfo.processName 对齐：用 owner.name 做规则匹配主键 */
      processName: string;
    }
  | {
      authorized: false;
      message: string;
    };

/**
 * 取当前前台窗口元数据。permission 失败 / 没有窗口 / 调用抛错 都收敛为
 * `{ authorized: false, message }`，调用方按显示态处理。
 */
export function getActiveWindowSnapshot(): ActiveWindowSnapshot {
  try {
    const result = activeWindowSync({
      accessibilityPermission: true,
      screenRecordingPermission: false,
    }) as ActiveWindowResult | undefined;

    if (!result) {
      // 通常是 macOS 没有授权（同时也覆盖：当前没有 active window，例如锁屏）。
      // 文案保持中性：renderer 会再根据 process.platform 决定是否提示「辅助功能权限」。
      return {
        authorized: false,
        message:
          process.platform === "darwin"
            ? "需要辅助功能权限：请在系统设置 → 隐私与安全 → 辅助功能 中允许 CursorDance。"
            : "无法获取当前前台窗口。",
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
      title: result.title || "",
      processName: owner.name,
    };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    // get-windows 在 macOS 没有辅助功能权限时会同步抛 native 错（execFileSync 失败），
    // 错误文本固定包含 "accessibility permission"。把这种 case 归一化到中文权限提示，
    // 其它平台 / 其它错误透传 raw message 便于排查。
    const isMacAccessibility =
      process.platform === "darwin" && /accessibility permission/i.test(raw);
    const message = isMacAccessibility
      ? "需要辅助功能权限：请在系统设置 → 隐私与安全 → 辅助功能 中允许 CursorDance。"
      : raw || "无法获取当前前台窗口。";
    return { authorized: false, message };
  }
}

export function registerActiveWindowIpc(): void {
  ipcMain.handle(APP_GET_ACTIVE_WINDOW, () => getActiveWindowSnapshot());
}

export function unregisterActiveWindowIpc(): void {
  ipcMain.removeHandler(APP_GET_ACTIVE_WINDOW);
}
