type RepositoryUnsubscribe = () => void;
export type RepositoryListener<T> = (value: T) => void | Promise<void>;

export type WorkbenchEditorState = {
  workspaceId?: string;
  themeId?: string;
  actionId?: string;
  cursorStateId?: string;
};

export type RecentCursorAsset = Record<string, unknown> & {
  id: string;
  imageDataUrl: string;
};

export type RuntimeDiagnosticEntry = Record<string, unknown>;

export interface WorkbenchRepository {
  readonly kind: "desktop" | "chrome" | "local";
  readonly recentAssetsPersistence: "chrome-local" | "local-storage" | "session";
  readConfig(): Promise<CursorDanceConfigRecord>;
  writeConfig(config: unknown): Promise<CursorDanceConfigRecord>;
  readLivePreview(): Promise<CursorDanceConfigRecord | null>;
  writeLivePreview(config: unknown): Promise<CursorDanceConfigRecord>;
  clearLivePreview(): Promise<void>;
  readEditorState(): Promise<WorkbenchEditorState | null>;
  writeEditorState(state: WorkbenchEditorState): Promise<void>;
  subscribeConfig(onChange: RepositoryListener<CursorDanceConfigRecord>): RepositoryUnsubscribe;
  subscribeLivePreview(onChange: RepositoryListener<CursorDanceConfigRecord | null>): RepositoryUnsubscribe;
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
  getDefaultConfig(): CursorDanceConfigRecord;
  normalizeConfig(value: unknown): CursorDanceConfigRecord;
}

export function notifyRepositoryListener<T>(listener: RepositoryListener<T>, value: T): void {
  Promise.resolve(listener(value)).catch((error) => {
    console.error("[cursordance] repository listener failed:", error);
  });
}
