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

/** renderer → 主进程：拉取当前前台应用元数据（进程名 / Bundle ID / 窗口标题），
 *  供 app-matcher 应用规则匹配使用。macOS 无辅助功能权限时返回 unauthorized 状态。 */
export const APP_GET_ACTIVE_WINDOW = "cursordance:app-get-active-window";

/** renderer → 主进程：读取 / 翻转 firstRun flag。
 *  flag 单独存盘（key: cursordance:firstRun），不污染 cursordance.config。
 *  WelcomeDialog 首次启动展示，关闭后写 false；后续启动直接跳过。 */
export const APP_GET_FIRST_RUN = "cursordance:app-get-first-run";
export const APP_MARK_FIRST_RUN_COMPLETE = "cursordance:app-mark-first-run-complete";

/** renderer → 主进程：调用 shell.openExternal 打开系统设置 / 文档链接。
 *  WelcomeDialog 与应用规则面板的「打开辅助功能设置」按钮使用。 */
export const APP_OPEN_EXTERNAL = "cursordance:app-open-external";

/** renderer → 主进程：自绘标题栏的窗口控制（最小化 / 切换最大化 / 关闭）。
 *  通过 BrowserWindow.fromWebContents(event.sender) 定位调用方窗口，无需带 windowId。 */
export const WINDOW_MINIMIZE = "cursordance:window-minimize";
export const WINDOW_TOGGLE_MAXIMIZE = "cursordance:window-toggle-maximize";
export const WINDOW_CLOSE = "cursordance:window-close";

/** renderer → 主进程：取当前调用方窗口快照（isMaximized / isFullScreen），
 *  Windows/Linux 自绘标题栏首次挂载时同步图标状态。 */
export const WINDOW_GET_STATE = "cursordance:window-get-state";

/** 主进程 → renderer：调用方窗口最大化 / 还原状态变化广播。 */
export const WINDOW_STATE_CHANGED = "cursordance:window-state-changed";

/** renderer → 主进程：拉取 AI API 运行时配置（endpoint / accessToken / 服务状态）。
 *  桌面版的 cursor-dance-api 由主进程嵌入启动，端口动态分配；renderer 启动时
 *  先 invoke 这个通道拿到 endpoint，再通过 install-runtime-globals 注入到
 *  globalThis.VITE_CURSORDANCE_AI_API_ENDPOINT 等全局，让 client.js 直接读用。 */
export const AI_GET_RUNTIME_CONFIG = "cursordance:ai-get-runtime-config";

/** renderer → 主进程：读取 / 写入 AI 用户设置（API key / model / baseUrl 等）。
 *  API key 用 safeStorage 加密，baseUrl/model 明文存。
 *  写入后立即热更 process.env 让嵌入的 server 使用最新值，无需重启 API。 */
export const AI_GET_USER_SETTINGS = "cursordance:ai-get-user-settings";
export const AI_SET_USER_SETTINGS = "cursordance:ai-set-user-settings";
