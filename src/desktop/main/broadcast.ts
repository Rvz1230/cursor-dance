import type { BrowserWindow } from "electron";

type GetAllWindows = () => BrowserWindow[];

/**
 * 向所有非销毁状态的窗口广播 IPC 消息。
 *
 * 窗口列表通过回调注入（而非硬编码 BrowserWindow.getAllWindows()），
 * 保持可测试性和解耦。renderer 进程可能正在关闭或导航，IPC 管道断开时
 * send 会抛异常——静默吞掉即可。
 */
export function broadcastToWindows(
  getAllWindows: GetAllWindows,
  channel: string,
  payload: unknown,
): void {
  for (const win of getAllWindows()) {
    sendToWindow(win, channel, payload);
  }
}

export function sendToWindow(win: BrowserWindow, channel: string, payload: unknown): void {
  if (win.isDestroyed()) return;
  try {
    win.webContents.send(channel, payload);
  } catch {
    // renderer 可能正在关闭/导航，IPC 管道已断，忽略即可。
  }
}

export type { GetAllWindows };
