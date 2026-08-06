type RepositoryUnsubscribe = () => void;
export type RepositoryListener<T> = (value: T) => void | Promise<void>;

/** 工作台的列宽权重。语义与夹取区间见 `hooks/useWorkbenchColumnLayout.ts`。 */
export type WorkbenchColumnWeightsState = {
  config: number;
  preview: number;
  ai: number;
};

/**
 * 编辑器导航与界面偏好。与主题配置分开存放：它描述「你把工作台摆成什么样」，
 * 不是主题内容，不该跟着主题导出。
 */
export type WorkbenchEditorState = {
  workspaceId?: string;
  themeId?: string;
  actionId?: string;
  cursorStateId?: string;
  columnWeights?: WorkbenchColumnWeightsState;
  libraryCollapsed?: boolean;
};

export interface CursorAssetDraft {
  imageDataUrl?: string;
  mimeType?: string;
  hotspotX?: number;
  hotspotY?: number;
  size?: number;
  sourceWidth?: number;
  sourceHeight?: number;
  name?: string;
}

export type RecentCursorAsset = CursorAssetDraft & Record<string, unknown> & {
  id: string;
  imageDataUrl: string;
};

export type RuntimeDiagnosticEntry = Record<string, unknown>;

export interface WorkbenchRepository {
  readonly kind: "desktop" | "chrome" | "local";
  readonly recentAssetsPersistence: "chrome-local" | "local-storage" | "session";
  readConfig(): Promise<CursorDanceConfig>;
  writeConfig(config: unknown): Promise<CursorDanceConfig>;
  readLivePreview(): Promise<CursorDanceConfig | null>;
  writeLivePreview(config: unknown): Promise<CursorDanceConfig>;
  clearLivePreview(): Promise<void>;
  readEditorState(): Promise<WorkbenchEditorState | null>;
  writeEditorState(state: WorkbenchEditorState): Promise<void>;
  subscribeConfig(onChange: RepositoryListener<CursorDanceConfig>): RepositoryUnsubscribe;
  subscribeLivePreview(onChange: RepositoryListener<CursorDanceConfig | null>): RepositoryUnsubscribe;
  readRecentCursorAssets(): Promise<RecentCursorAsset[]>;
  writeRecentCursorAsset(asset: unknown): Promise<RecentCursorAsset[]>;
  readRuntimeErrors(): Promise<RuntimeDiagnosticEntry[]>;
  clearRuntimeErrors(): Promise<void>;
  readDiagnosticDebugFlag(): Promise<boolean>;
  writeDiagnosticDebugFlag(enabled: boolean): Promise<void>;
  readRuntimeDiagnostics(): Promise<RuntimeDiagnosticEntry[]>;
  subscribeRuntimeDiagnostics(onChange: RepositoryListener<RuntimeDiagnosticEntry>): RepositoryUnsubscribe;
}

export interface WorkbenchRepositoryCodec {
  getDefaultConfig(): CursorDanceConfig;
  normalizeConfig(value: unknown): CursorDanceConfig;
}

export function notifyRepositoryListener<T>(listener: RepositoryListener<T>, value: T): void {
  Promise.resolve(listener(value)).catch((error) => {
    console.error("[cursordance] repository listener failed:", error);
  });
}
import type { CursorDanceConfig } from "@/shared/domain/cursor-dance";
