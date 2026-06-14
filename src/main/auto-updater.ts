// 任务 6.1：electron-updater 集成
//
// 职责：
//   - 在 packaged 模式下定时检查 GitHub Releases（默认 4 小时一次）
//   - 启动时立即触发一次 checkForUpdatesAndNotify
//   - dev 模式 / non-packaged 跳过 —— 否则 electron-updater 会读 app-update.yml
//     抛 ENOENT，污染 console
//
// 不在本模块职责：
//   - 更新提示 UI（dialog / toast）—— 当前只 console.log，dogfood 阶段排查用
//   - 强制重启 —— autoInstallOnAppQuit 默认 true，正常退出时自动应用
//
// 单测策略：
//   - vi.mock 替换 electron 与 electron-updater，避免引入真包
//   - 验证 dev (skipped) / packaged (调度 + interval) / stop 清理三条路径

import { app } from "electron";
import { autoUpdater } from "electron-updater";

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

let intervalHandle: NodeJS.Timeout | null = null;
let registered = false;

interface RegisterOptions {
  /** 测试用 —— 主流程不必传，默认 4h。 */
  intervalMs?: number;
  /** 测试用 —— 默认读 app.isPackaged。 */
  isPackaged?: boolean;
}

export function registerAutoUpdater(options: RegisterOptions = {}): () => void {
  if (registered) {
    // 双重注册无害但会拉两个 interval —— 直接拒绝，让调用方意识到生命周期问题。
    console.warn("[auto-updater] already registered; ignoring repeat call");
    return stopAutoUpdater;
  }

  const isPackaged = options.isPackaged ?? app.isPackaged;
  if (!isPackaged) {
    console.log("[auto-updater] skipped in dev (app not packaged)");
    return () => undefined;
  }

  registered = true;

  // 显式写出默认值，方便审计行为：下载完成会等到下次正常退出时安装。
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("error", (error) => {
    console.error("[auto-updater] error:", error);
  });
  autoUpdater.on("checking-for-update", () => {
    console.log("[auto-updater] checking for update");
  });
  autoUpdater.on("update-available", (info) => {
    console.log("[auto-updater] update available:", info.version);
  });
  autoUpdater.on("update-not-available", () => {
    console.log("[auto-updater] no update available");
  });
  autoUpdater.on("download-progress", (progress) => {
    console.log(
      `[auto-updater] download progress: ${Math.round(progress.percent)}%`,
    );
  });
  autoUpdater.on("update-downloaded", (info) => {
    console.log("[auto-updater] update downloaded:", info.version);
  });

  // 立即触发一次；后续按 interval 轮询。failure 已被上面的 error handler 捕获。
  void autoUpdater.checkForUpdatesAndNotify();

  const intervalMs = options.intervalMs ?? FOUR_HOURS_MS;
  intervalHandle = setInterval(() => {
    void autoUpdater.checkForUpdatesAndNotify();
  }, intervalMs);

  return stopAutoUpdater;
}

function stopAutoUpdater(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  registered = false;
}

// 仅给单测用 —— 重置内部状态，下一轮 register 才会真正执行。
export const __testing__ = {
  reset(): void {
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
    registered = false;
  },
  isRegistered(): boolean {
    return registered;
  },
  hasInterval(): boolean {
    return intervalHandle !== null;
  },
};
