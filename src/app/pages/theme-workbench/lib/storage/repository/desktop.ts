import {
  assetIdFromDesktopAssetUrl,
  isDesktopAssetId,
} from "@/shared/asset-reference";
import { readLocalEditorState, writeLocalEditorState } from "./local-editor-state";
import {
  notifyRepositoryListener,
  type WorkbenchRepository,
  type WorkbenchRepositoryCodec,
} from "./types";
import { createBrowserFallbackSupport } from "./support";

type TransportImage = {
  kind?: unknown;
  dataUrl?: unknown;
  assetId?: unknown;
  mimeType?: unknown;
  width?: unknown;
  height?: unknown;
};

type TransportState = { image?: TransportImage };
type TransportAction = Record<string, unknown>;
type TransportTheme = {
  id?: unknown;
  cursorSkin?: { states?: Record<string, TransportState> };
  actionConfigs?: Record<string, TransportAction>;
};
type TransportConfig = { themes?: TransportTheme[] };

function cloneConfig(config: unknown): TransportConfig {
  return JSON.parse(JSON.stringify(config)) as TransportConfig;
}

export function createDesktopWorkbenchRepository(
  bridge: CursorDanceStorageBridge,
  codec: WorkbenchRepositoryCodec,
): WorkbenchRepository {
  const assetIdByDataUrl = new Map<string, string>();
  const support = createBrowserFallbackSupport("session");

  function canonicalizeCachedAssets(config: unknown): TransportConfig {
    const next = cloneConfig(config);
    for (const theme of next.themes || []) {
      for (const state of Object.values(theme.cursorSkin?.states || {})) {
        const image = state.image;
        if (image?.kind !== "dataUrl" || typeof image.dataUrl !== "string") continue;
        const assetId = assetIdByDataUrl.get(image.dataUrl);
        if (!assetId) continue;
        state.image = {
          kind: "asset",
          assetId,
          mimeType: image.mimeType,
          width: image.width,
          height: image.height,
        };
      }
      for (const action of Object.values(theme.actionConfigs || {})) {
        const imageDataUrl = typeof action.imageDataUrl === "string" ? action.imageDataUrl : "";
        if ("imageDataUrl" in action && imageDataUrl === "") {
          delete action.imageAssetId;
          continue;
        }
        const assetId = assetIdByDataUrl.get(imageDataUrl)
          ?? assetIdFromDesktopAssetUrl(imageDataUrl)
          ?? (isDesktopAssetId(action.imageAssetId) ? action.imageAssetId : null);
        if (!assetId) continue;
        action.imageAssetId = assetId;
        delete action.imageDataUrl;
      }
    }
    return next;
  }

  function rememberMaterializedAssets(sourceValue: unknown, storedValue: unknown): void {
    const sourceConfig = sourceValue as TransportConfig;
    const storedConfig = storedValue as TransportConfig;
    const storedThemes = new Map((storedConfig.themes || []).map((theme) => [theme.id, theme]));
    for (const sourceTheme of sourceConfig.themes || []) {
      const storedTheme = storedThemes.get(sourceTheme.id);
      if (!storedTheme) continue;
      for (const [stateId, sourceState] of Object.entries(sourceTheme.cursorSkin?.states || {})) {
        const sourceImage = sourceState.image;
        const storedImage = storedTheme.cursorSkin?.states?.[stateId]?.image;
        if (
          sourceImage?.kind === "dataUrl"
          && typeof sourceImage.dataUrl === "string"
          && isDesktopAssetId(storedImage?.assetId)
        ) {
          assetIdByDataUrl.set(sourceImage.dataUrl, storedImage.assetId);
        }
      }
      for (const [actionId, sourceAction] of Object.entries(sourceTheme.actionConfigs || {})) {
        const imageDataUrl = sourceAction.imageDataUrl;
        const assetId = storedTheme.actionConfigs?.[actionId]?.imageAssetId;
        if (typeof imageDataUrl === "string" && imageDataUrl.startsWith("data:") && isDesktopAssetId(assetId)) {
          assetIdByDataUrl.set(imageDataUrl, assetId);
        }
      }
    }
  }

  async function writeWithAssets(
    config: unknown,
    write: (payload: unknown) => Promise<unknown>,
  ): Promise<CursorDanceConfigRecord> {
    const normalized = codec.normalizeConfig(config);
    const stored = await write(canonicalizeCachedAssets(normalized));
    const materialized = stored ? codec.normalizeConfig(stored) : normalized;
    rememberMaterializedAssets(normalized, materialized);
    return materialized;
  }

  const repository: WorkbenchRepository = {
    kind: "desktop",
    ...support,
    async readConfig() {
      const stored = await bridge.getConfig();
      if (!stored) return repository.writeConfig(codec.getDefaultConfig());
      const normalized = codec.normalizeConfig(stored);
      if (normalized !== stored) return repository.writeConfig(normalized);
      return normalized;
    },
    writeConfig(config) {
      return writeWithAssets(config, (payload) => bridge.setConfig(payload));
    },
    async readLivePreview() {
      const stored = await bridge.getLivePreview();
      return stored ? codec.normalizeConfig(stored) : null;
    },
    writeLivePreview(config) {
      return writeWithAssets(config, (payload) => bridge.setLivePreview(payload));
    },
    clearLivePreview() {
      return bridge.clearLivePreview();
    },
    readEditorState: readLocalEditorState,
    writeEditorState: writeLocalEditorState,
    subscribeConfig(onChange) {
      return bridge.onChange((next) => {
        notifyRepositoryListener(
          onChange,
          next ? codec.normalizeConfig(next) : codec.normalizeConfig(codec.getDefaultConfig()),
        );
      });
    },
    subscribeLivePreview(onChange) {
      return bridge.onLivePreviewChange((next) => {
        notifyRepositoryListener(onChange, next ? codec.normalizeConfig(next) : null);
      });
    },
  };
  return repository;
}
