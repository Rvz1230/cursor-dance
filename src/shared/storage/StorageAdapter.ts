/**
 * 存储适配器接口 —— 抽象 Chrome 扩展和 Electron 桌面版之间的存储差异。
 *
 * 接口设计面向业务语义（readConfig / writeConfig 等），而非暴露底层存储原语。
 * 每个平台在实现内部消化 key 管理、序列化、变更广播等细节。
 *
 * 扩展实现：ChromeStorageAdapter（封装 chrome.storage.local/session + localStorage fallback）
 * 桌面实现：ElectronStoreAdapter（封装 electron-store，通过 IPC 与主进程通信）
 */

/**
 * CursorDance 运行时配置对象。
 *
 * 对应 `chrome.storage.local` 中 `cursordance.config` key 存储的值，
 * 经过 `normalizeStoredConfig()` 处理后的形态。主要字段：
 * - enabled, activeThemePackId, activeSchemeId
 * - themePacks / schemes（主题包数组）
 * - siteRules（站点/应用规则数组）
 * - editor（编辑器状态）
 * - workbenchDraft（工作台草稿，嵌套在每个 themePack 内）
 */
export interface CursorDanceConfig {
  enabled?: boolean;
  activeThemePackId?: string;
  activeSchemeId?: string;
  themePacks?: Array<Record<string, unknown>>;
  schemes?: Array<Record<string, unknown>>;
  siteRules?: Array<Record<string, unknown>>;
  editor?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * 存储适配器接口。
 *
 * 每个方法对应一个具体的业务操作，而非暴露底层 key-value 读写。
 * 调用方不需要知道 key 名称、序列化格式、或平台差异。
 */
export interface StorageAdapter {
  /** 读取持久化的完整配置 */
  readConfig(): Promise<CursorDanceConfig>;

  /** 写入完整配置到持久化存储 */
  writeConfig(config: CursorDanceConfig): Promise<void>;

  /** 读取实时预览配置（会话级，重启后丢失） */
  readLivePreview(): Promise<CursorDanceConfig | null>;

  /** 写入实时预览配置 */
  writeLivePreview(config: CursorDanceConfig): Promise<void>;

  /** 清除实时预览配置 */
  clearLivePreview(): Promise<void>;

  /**
   * 订阅配置变更。
   *
   * @param callback - 当配置被其他上下文修改时触发，传入最新配置
   * @returns 取消订阅的函数
   */
  onChanged(callback: (config: CursorDanceConfig) => void): () => void;
}
