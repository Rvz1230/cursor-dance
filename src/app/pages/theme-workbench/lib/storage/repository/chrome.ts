import { CURSOR_STATES } from "../../../model/workbenchSchema";
import {
  CONFIG_STORAGE_KEY,
  CURSOR_ASSET_STORAGE_KEY_PREFIX,
  DIAGNOSTIC_DEBUG_KEY,
  EDITOR_STATE_STORAGE_KEY,
  LIVE_PREVIEW_CONFIG_STORAGE_KEY,
  MAX_CURSOR_ASSET_DATA_URL_LENGTH,
  RECENT_CURSOR_ASSETS_STORAGE_KEY,
  RUNTIME_ERRORS_STORAGE_KEY,
  buildCursorAssetStorageKey,
  ensurePreviewStorageAccess,
  parseBooleanFlag,
} from "../chrome-api";
import {
  notifyRepositoryListener,
  type RecentCursorAsset,
  type RuntimeDiagnosticEntry,
  type WorkbenchRepository,
  type WorkbenchRepositoryCodec,
} from "./types";
import { mergeEditorState, normalizeEditorState } from "./local-editor-state";
import { dedupeRecentAssets, normalizeRecentAsset } from "./support";
import type { CursorDanceConfig } from "@/shared/config/default-config";
import type {
  CursorDanceThemeV4,
  CursorSkinStateV4,
} from "@/shared/config-schema-v4";

const DIAGNOSTIC_EVENTS_STORAGE_KEY = "cursordance.diagnosticEvents";

function reportSubscriptionError(error: unknown): void {
  console.error("[cursordance] repository subscription failed:", error);
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function buildCursorAssetStorageKeys(config: CursorDanceConfig): string[] {
  const keys = new Set<string>();
  for (const theme of config.themes) {
    const themeId = theme.id;
    for (const state of CURSOR_STATES) keys.add(buildCursorAssetStorageKey(themeId, state.id));
    for (const state of Object.values(theme.cursorSkin.states)) {
      if (state.image.kind === "asset") keys.add(state.image.assetId);
    }
  }
  return [...keys];
}

function withResolvedCursorAssets(
  config: CursorDanceConfig,
  assetEntries: Record<string, unknown>,
): CursorDanceConfig {
  const themes: CursorDanceThemeV4[] = config.themes.map((theme) => {
    const states: Record<string, CursorSkinStateV4> = Object.fromEntries(
      Object.entries(theme.cursorSkin.states).map(([stateId, state]) => {
        const image = state.image;
        if (image.kind !== "asset") return [stateId, state];
        const assetRecord = asRecord(assetEntries[image.assetId]);
        if (typeof assetRecord?.imageDataUrl !== "string") return [stateId, state];
        return [stateId, {
          ...state,
          image: {
            kind: "dataUrl" as const,
            mimeType: image.mimeType,
            dataUrl: assetRecord.imageDataUrl,
            width: image.width,
            height: image.height,
          },
        }];
      }),
    );
    return {
      ...theme,
      cursorSkin: {
        ...theme.cursorSkin,
        states,
      },
    };
  });
  return { ...config, themes };
}

function stripInlineCursorAssets(config: CursorDanceConfig): CursorDanceConfig {
  const themes: CursorDanceThemeV4[] = config.themes.map((theme) => {
    const states: Record<string, CursorSkinStateV4> = Object.fromEntries(
      Object.entries(theme.cursorSkin.states).map(([stateId, state]) => {
        const image = state.image;
        if (image.kind !== "dataUrl") return [stateId, state];
        return [stateId, {
          ...state,
          image: {
            kind: "asset" as const,
            assetId: buildCursorAssetStorageKey(theme.id, stateId),
            mimeType: image.mimeType,
            width: image.width,
            height: image.height,
          },
        }];
      }),
    );
    return {
      ...theme,
      cursorSkin: {
        ...theme.cursorSkin,
        states,
      },
    };
  });
  return { ...config, themes };
}

export function createChromeWorkbenchRepository(
  chromeApi: Chrome,
  codec: WorkbenchRepositoryCodec,
): WorkbenchRepository {
  async function resolveCursorAssets(config: CursorDanceConfig): Promise<CursorDanceConfig> {
    const assetKeys = buildCursorAssetStorageKeys(config);
    if (!assetKeys.length) return config;
    return withResolvedCursorAssets(config, await chromeApi.storage.local.get(assetKeys));
  }

  const repository: WorkbenchRepository = {
    kind: "chrome",
    recentAssetsPersistence: "chrome-local",
    async readConfig() {
      const result = await chromeApi.storage.local.get([CONFIG_STORAGE_KEY]);
      const stored = result[CONFIG_STORAGE_KEY];
      const normalized = codec.normalizeConfig(stored || codec.getDefaultConfig());
      if (!stored || normalized !== stored) return repository.writeConfig(normalized);
      return resolveCursorAssets(normalized);
    },
    async writeConfig(config) {
      const normalized = codec.normalizeConfig(config);
      const assetWrites: Record<string, unknown> = {};
      const assetRemovals: string[] = [];
      for (const theme of normalized.themes) {
        const themeId = theme.id;
        const states = theme.cursorSkin.states;
        for (const [stateId, state] of Object.entries(states)) {
          const image = state.image;
          const imageDataUrl = image.kind === "dataUrl"
            ? image.dataUrl
            : "";
          if (imageDataUrl.length > MAX_CURSOR_ASSET_DATA_URL_LENGTH) {
            throw new Error(`光标图片过大，当前 ${stateId} 状态请换成更小的 PNG / WebP 后再保存。`);
          }
          const assetKey = buildCursorAssetStorageKey(themeId, stateId);
          if (imageDataUrl) assetWrites[assetKey] = { imageDataUrl, updatedAt: Date.now() };
          else assetRemovals.push(assetKey);
        }
        for (const cursorState of CURSOR_STATES) {
          if (!(cursorState.id in states)) assetRemovals.push(buildCursorAssetStorageKey(themeId, cursorState.id));
        }
      }
      if (Object.keys(assetWrites).length) await chromeApi.storage.local.set(assetWrites);
      if (assetRemovals.length) await chromeApi.storage.local.remove(assetRemovals);
      const stored = stripInlineCursorAssets(normalized);
      await chromeApi.storage.local.set({ [CONFIG_STORAGE_KEY]: stored });
      return resolveCursorAssets(stored);
    },
    async readLivePreview() {
      await ensurePreviewStorageAccess(chromeApi);
      try {
        const result = await chromeApi.storage.session.get([LIVE_PREVIEW_CONFIG_STORAGE_KEY]);
        const stored = result[LIVE_PREVIEW_CONFIG_STORAGE_KEY];
        return stored ? codec.normalizeConfig(stored) : null;
      } catch {
        return null;
      }
    },
    async writeLivePreview(config) {
      const normalized = codec.normalizeConfig(config);
      await ensurePreviewStorageAccess(chromeApi);
      await chromeApi.storage.session.set({ [LIVE_PREVIEW_CONFIG_STORAGE_KEY]: normalized });
      return normalized;
    },
    async clearLivePreview() {
      await ensurePreviewStorageAccess(chromeApi);
      await chromeApi.storage.session.remove([LIVE_PREVIEW_CONFIG_STORAGE_KEY]);
    },
    async readEditorState() {
      try {
        const result = await chromeApi.storage.local.get([EDITOR_STATE_STORAGE_KEY]);
        return normalizeEditorState(result[EDITOR_STATE_STORAGE_KEY]);
      } catch {
        return null;
      }
    },
    async writeEditorState(patch) {
      try {
        // patch 语义：见 local-editor-state.ts 的 mergeEditorState。
        const result = await chromeApi.storage.local.get([EDITOR_STATE_STORAGE_KEY]);
        const merged = mergeEditorState(normalizeEditorState(result[EDITOR_STATE_STORAGE_KEY]), patch);
        await chromeApi.storage.local.set({ [EDITOR_STATE_STORAGE_KEY]: merged });
      } catch {
        // Editor navigation state is best-effort.
      }
    },
    subscribeConfig(onChange) {
      const processChanges = async (changes: Record<string, unknown>, areaName: string) => {
        if (areaName !== "local") return;
        const changedKeys = Object.keys(changes);
        if (changedKeys.some((key) => key === CONFIG_STORAGE_KEY || key.startsWith(CURSOR_ASSET_STORAGE_KEY_PREFIX))) {
          notifyRepositoryListener(onChange, await repository.readConfig());
        }
      };
      const handleChanges = (changes: Record<string, unknown>, areaName: string) => {
        void processChanges(changes, areaName).catch(reportSubscriptionError);
      };
      chromeApi.storage.onChanged.addListener(handleChanges);
      return () => chromeApi.storage.onChanged.removeListener(handleChanges);
    },
    subscribeLivePreview(onChange) {
      const handleChanges = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
        if (areaName !== "session" || !changes[LIVE_PREVIEW_CONFIG_STORAGE_KEY]) return;
        const next = changes[LIVE_PREVIEW_CONFIG_STORAGE_KEY].newValue;
        notifyRepositoryListener(onChange, next ? codec.normalizeConfig(next) : null);
      };
      chromeApi.storage.onChanged.addListener(handleChanges);
      return () => chromeApi.storage.onChanged.removeListener(handleChanges);
    },
    async readRecentCursorAssets() {
      const result = await chromeApi.storage.local.get([RECENT_CURSOR_ASSETS_STORAGE_KEY]);
      const stored = result[RECENT_CURSOR_ASSETS_STORAGE_KEY];
      return Array.isArray(stored)
        ? stored.map(normalizeRecentAsset).filter((item): item is RecentCursorAsset => Boolean(item))
        : [];
    },
    async writeRecentCursorAsset(asset) {
      const next = dedupeRecentAssets(await repository.readRecentCursorAssets(), asset);
      await chromeApi.storage.local.set({ [RECENT_CURSOR_ASSETS_STORAGE_KEY]: next });
      return next;
    },
    async readRuntimeErrors() {
      try {
        const result = await chromeApi.storage.local.get([RUNTIME_ERRORS_STORAGE_KEY]);
        const stored = result[RUNTIME_ERRORS_STORAGE_KEY];
        return Array.isArray(stored)
          ? stored.filter((entry): entry is RuntimeDiagnosticEntry => Boolean(asRecord(entry)))
          : [];
      } catch {
        return [];
      }
    },
    async clearRuntimeErrors() {
      try {
        await chromeApi.storage.local.remove([RUNTIME_ERRORS_STORAGE_KEY]);
      } catch {}
    },
    async readDiagnosticDebugFlag() {
      try {
        const result = await chromeApi.storage.local.get([DIAGNOSTIC_DEBUG_KEY]);
        return parseBooleanFlag(result[DIAGNOSTIC_DEBUG_KEY]);
      } catch {
        return false;
      }
    },
    async writeDiagnosticDebugFlag(enabled) {
      try {
        if (enabled) await chromeApi.storage.local.set({ [DIAGNOSTIC_DEBUG_KEY]: "1" });
        else await chromeApi.storage.local.remove([DIAGNOSTIC_DEBUG_KEY]);
      } catch {}
    },
    async readRuntimeDiagnostics() {
      try {
        const result = await chromeApi.storage.local.get([DIAGNOSTIC_EVENTS_STORAGE_KEY]);
        const stored = result[DIAGNOSTIC_EVENTS_STORAGE_KEY];
        return Array.isArray(stored)
          ? stored.filter((entry): entry is RuntimeDiagnosticEntry => Boolean(asRecord(entry)))
          : [];
      } catch {
        return [];
      }
    },
    subscribeRuntimeDiagnostics(onChange) {
      const seenKeys = new Set<string>();
      const handleChanges = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
        if (areaName !== "local" || !changes[DIAGNOSTIC_EVENTS_STORAGE_KEY]) return;
        const next = changes[DIAGNOSTIC_EVENTS_STORAGE_KEY].newValue;
        if (!Array.isArray(next)) return;
        for (const value of next) {
          const entry = asRecord(value);
          if (!entry) continue;
          const key = `${entry.scope || ""}::${entry.at || ""}`;
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);
          notifyRepositoryListener(onChange, entry);
        }
      };
      chromeApi.storage.onChanged.addListener(handleChanges);
      return () => chromeApi.storage.onChanged.removeListener(handleChanges);
    },
  };
  return repository;
}
