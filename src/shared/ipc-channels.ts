// CursorDance IPC 通道常量
//
// main / preload / renderer 三方共享。新增通道时同步更新这里 + preload 暴露 + 文档。

/** 主进程 → overlay/workbench：全局鼠标事件投递 */
export const CURSOR_EVENT = "cursordance:cursor-event";

/** 主进程 → overlay/workbench：debug toggle 推送 */
export const DEBUG_TOGGLE = "cursordance:debug-toggle";

/** renderer → 主进程：读取 / 写入 electron-store */
export const STORE_GET = "cursordance:store-get";
export const STORE_SET = "cursordance:store-set";

/** renderer → 主进程：申请预览（test action）由主进程派发到 overlay */
export const PREVIEW_AT_VIEWPORT_CENTER = "cursordance:preview-at-viewport-center";
