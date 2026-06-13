// CursorDance IPC 通道常量
//
// main / preload / renderer 三方共享。新增通道时同步更新这里 + preload 暴露 + 文档。

/** 主进程 → overlay/workbench：全局鼠标事件投递 */
export const CURSOR_EVENT = "cursordance:cursor-event";

/** 主进程 → overlay/workbench：debug toggle 推送 */
export const DEBUG_TOGGLE = "cursordance:debug-toggle";

/** renderer → 主进程：读取 / 写入 electron-store 持久化 config */
export const STORE_GET = "cursordance:store-get";
export const STORE_SET = "cursordance:store-set";

/** 主进程 → renderer：持久化 config 变更广播（任意窗口写入后，所有窗口都收到一份新值） */
export const STORE_CHANGED = "cursordance:store-changed";

/** renderer → 主进程：读取 / 写入 / 清除 内存版 live preview（不持久化，进程级） */
export const STORE_GET_LIVE_PREVIEW = "cursordance:store-get-live-preview";
export const STORE_SET_LIVE_PREVIEW = "cursordance:store-set-live-preview";
export const STORE_CLEAR_LIVE_PREVIEW = "cursordance:store-clear-live-preview";

/** 主进程 → renderer：live preview 变更广播 */
export const LIVE_PREVIEW_CHANGED = "cursordance:live-preview-changed";

/** renderer → 主进程：申请预览（test action）由主进程派发到 overlay */
export const PREVIEW_AT_VIEWPORT_CENTER = "cursordance:preview-at-viewport-center";

/** renderer → 主进程：导出主题包到本地文件（弹原生保存对话框 + 写盘） */
export const DIALOG_SAVE_THEME_FILE = "cursordance:dialog-save-theme-file";

/** renderer → 主进程：从本地文件导入主题包（弹原生打开对话框 + 读盘） */
export const DIALOG_OPEN_THEME_FILE = "cursordance:dialog-open-theme-file";
