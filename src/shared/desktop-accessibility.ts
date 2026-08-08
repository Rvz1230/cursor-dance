/**
 * macOS 全局输入监听的运行状态。
 *
 * `unsupported` 表示当前平台不需要 macOS 的辅助功能授权；此时监听已经启动。
 * `required` 表示监听尚未启动，用户需要在系统设置中授权。
 */
export type DesktopAccessibilityState =
  | { status: "unsupported" }
  | { status: "required" }
  | { status: "starting" }
  | { status: "running" }
  | { status: "error"; message: string };

export function isAccessibilityReady(state: DesktopAccessibilityState): boolean | null {
  if (state.status === "running" || state.status === "unsupported") return true;
  if (state.status === "required") return false;
  return null;
}
