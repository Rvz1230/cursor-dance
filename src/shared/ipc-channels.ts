// CursorDance IPC 通道常量
//
// main / preload / renderer 三方共享。invoke 请求/响应类型见 desktop-ipc-contracts.ts；
// 新增 invoke 通道时还必须登记主进程 ipc-security sender policy。

/** 主进程 → overlay/workbench：全局鼠标事件投递 */
export const CURSOR_EVENT = "cursordance:cursor-event";

/** 主进程 → overlay：全局键盘事件投递 */
export const KEYBOARD_EVENT = "cursordance:keyboard-event";

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

/** renderer → 主进程：导出主题包到本地文件（弹原生保存对话框 + 写盘） */
export const DIALOG_SAVE_THEME_FILE = "cursordance:dialog-save-theme-file";

/** renderer → 主进程：从本地文件导入主题包（弹原生打开对话框 + 读盘） */
export const DIALOG_OPEN_THEME_FILE = "cursordance:dialog-open-theme-file";

/** renderer → 主进程：拉取当前前台应用元数据（进程名 / Bundle ID / 窗口标题），
 *  供应用规则匹配使用。macOS 无辅助功能权限时返回 unauthorized 状态。 */
export const APP_GET_ACTIVE_WINDOW = "cursordance:app-get-active-window";
export const APP_LIST_INSTALLED_APPLICATIONS = "cursordance:app-list-installed-applications";
export const APP_PICK_WINDOW = "cursordance:app-pick-window";

/** 主进程 → renderer：前台应用或授权状态发生变化。 */
export const APP_ACTIVE_WINDOW_CHANGED = "cursordance:app-active-window-changed";

/** renderer → 主进程：读取 / 翻转 firstRun flag。
 *  flag 单独存盘（key: cursordance:firstRun），不污染 cursordance.config。
 *  WelcomeDialog 首次启动展示，关闭后写 false；后续启动直接跳过。 */
export const APP_GET_FIRST_RUN = "cursordance:app-get-first-run";
export const APP_MARK_FIRST_RUN_COMPLETE = "cursordance:app-mark-first-run-complete";

/** renderer → 主进程：调用 shell.openExternal 打开系统设置 / 文档链接。
 *  WelcomeDialog 与应用规则面板的「打开辅助功能设置」按钮使用。 */
export const APP_OPEN_EXTERNAL = "cursordance:app-open-external";

/** Workbench → 主进程：读取更新状态、手动检查/下载，以及确认重启安装。
 *  主进程通过 APP_UPDATE_STATE_CHANGED 将状态机变化推回 Workbench。 */
export const APP_UPDATE_GET_STATE = "cursordance:app-update-get-state";
export const APP_UPDATE_CHECK = "cursordance:app-update-check";
export const APP_UPDATE_DOWNLOAD = "cursordance:app-update-download";
export const APP_UPDATE_INSTALL = "cursordance:app-update-install";
export const APP_UPDATE_STATE_CHANGED = "cursordance:app-update-state-changed";

/** renderer → 主进程：macOS overlay 自绘光标时隐藏 / 恢复系统原生 cursor。 */
export const CURSOR_VISIBILITY_SET_HIDDEN = "cursordance:cursor-visibility-set-hidden";

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

/** renderer → 主进程：读取 / 写入 AI 用户设置（API key / model / baseUrl 等）。
 *  API key 用 safeStorage 加密，baseUrl/model 明文存。
 *  写入后立即热更主进程 provider 配置。 */
export const AI_GET_USER_SETTINGS = "cursordance:ai-get-user-settings";
export const AI_SET_USER_SETTINGS = "cursordance:ai-set-user-settings";

/** renderer → 主进程：桌面 AI typed IPC transport。流式进度通过 AI_REQUEST_EVENT
 *  单向推回发起请求的 Workbench，API key 始终只存在于主进程。 */
export const AI_CREATE_PROPOSAL_STREAM = "cursordance:ai-create-proposal-stream";
export const AI_RUN_AGENT = "cursordance:ai-run-agent";
export const AI_CANCEL_REQUEST = "cursordance:ai-cancel-request";
export const AI_REQUEST_EVENT = "cursordance:ai-request-event";
