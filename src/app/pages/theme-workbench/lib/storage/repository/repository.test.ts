import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONFIG_STORAGE_KEY,
  DIAGNOSTIC_DEBUG_KEY,
  EDITOR_STATE_STORAGE_KEY,
  RECENT_CURSOR_ASSETS_STORAGE_KEY,
  buildCursorAssetStorageKey,
} from "../chrome-api";
import { createChromeWorkbenchRepository } from "./chrome";
import { createDesktopWorkbenchRepository } from "./desktop";
import { createLocalWorkbenchRepository } from "./local";
import type { WorkbenchRepositoryCodec } from "./types";

const codec: WorkbenchRepositoryCodec = {
  getDefaultConfig: () => ({ schemaVersion: 4, enabled: true, themes: [] }),
  normalizeConfig: (value) => value as CursorDanceConfigRecord,
};

function installLocalWindow() {
  const values = new Map<string, string>();
  const localStorage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn((key: string) => { values.delete(key); }),
  };
  class FakeBroadcastChannel {
    addEventListener = vi.fn();
    removeEventListener = vi.fn();
    postMessage = vi.fn();
    close = vi.fn();
  }
  Object.assign(globalThis, {
    window: {
      localStorage,
      BroadcastChannel: FakeBroadcastChannel,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
  return { values, localStorage };
}

function createChromeApi() {
  const localValues: Record<string, unknown> = {};
  const sessionValues: Record<string, unknown> = {};
  const listeners = new Set<(changes: Record<string, { newValue?: unknown }>, area: string) => void>();
  const area = (values: Record<string, unknown>) => ({
    get: vi.fn(async (keys: string | string[]) => {
      const selected = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(selected.map((key) => [key, values[key]]));
    }),
    set: vi.fn(async (items: Record<string, unknown>) => { Object.assign(values, items); }),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key];
    }),
  });
  const local = area(localValues);
  const session = { ...area(sessionValues), setAccessLevel: vi.fn(async () => {}) };
  const chromeApi = {
    storage: {
      local,
      session,
      onChanged: {
        addListener: vi.fn((listener) => listeners.add(listener)),
        removeListener: vi.fn((listener) => listeners.delete(listener)),
      },
    },
  } as unknown as Chrome;
  return { chromeApi, localValues, sessionValues, listeners };
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("WorkbenchRepository adapters", () => {
  it("keeps local config, editor state, recent assets and debug state behind one contract", async () => {
    const { values } = installLocalWindow();
    const repository = createLocalWorkbenchRepository(codec);
    expect(repository.kind).toBe("local");
    expect(repository.recentAssetsPersistence).toBe("local-storage");

    await repository.writeConfig({ schemaVersion: 4, enabled: false, themes: [] });
    expect((await repository.readConfig()).enabled).toBe(false);
    await repository.writeEditorState({ workspaceId: "sites", actionId: "wheel" });
    expect(await repository.readEditorState()).toEqual({ workspaceId: "sites", actionId: "wheel" });
    await repository.writeRecentCursorAsset({ imageDataUrl: "data:image/png;base64,AA==", name: "one" });
    expect(await repository.readRecentCursorAssets()).toHaveLength(1);
    await repository.writeDiagnosticDebugFlag(true);
    expect(await repository.readDiagnosticDebugFlag()).toBe(true);
    expect(values.has(CONFIG_STORAGE_KEY)).toBe(true);
    expect(values.has(EDITOR_STATE_STORAGE_KEY)).toBe(true);
    expect(values.has(RECENT_CURSOR_ASSETS_STORAGE_KEY)).toBe(true);
    expect(values.get(DIAGNOSTIC_DEBUG_KEY)).toBe("1");
  });

  it("uses typed desktop bridge storage and session-only recent assets", async () => {
    installLocalWindow();
    const config = { schemaVersion: 4, enabled: true, themes: [] };
    const bridge = {
      getConfig: vi.fn(async () => config),
      setConfig: vi.fn(async (value) => value),
      getLivePreview: vi.fn(async () => null),
      setLivePreview: vi.fn(async (value) => value),
      clearLivePreview: vi.fn(async () => {}),
      onChange: vi.fn(() => () => {}),
      onLivePreviewChange: vi.fn(() => () => {}),
    } as CursorDanceStorageBridge;
    const repository = createDesktopWorkbenchRepository(bridge, codec);
    expect(repository.kind).toBe("desktop");
    expect(repository.recentAssetsPersistence).toBe("session");
    expect(await repository.readConfig()).toBe(config);
    await repository.writeLivePreview({ ...config, enabled: false });
    expect(bridge.setLivePreview).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    await repository.writeRecentCursorAsset({ imageDataUrl: "data:image/png;base64,AA==" });
    expect(await repository.readRecentCursorAssets()).toHaveLength(1);
  });

  it("keeps Chrome cursor blobs and auxiliary state in chrome.storage.local", async () => {
    const { chromeApi, localValues } = createChromeApi();
    const repository = createChromeWorkbenchRepository(chromeApi, codec);
    const config = {
      schemaVersion: 4,
      enabled: true,
      themes: [{
        id: "theme-a",
        cursorSkin: {
          states: {
            default: {
              image: { kind: "dataUrl", dataUrl: "data:image/png;base64,AA==", mimeType: "image/png", width: 1, height: 1 },
            },
          },
        },
      }],
    };
    const saved = await repository.writeConfig(config);
    const assetKey = buildCursorAssetStorageKey("theme-a", "default");
    expect(asRecord(localValues[CONFIG_STORAGE_KEY])?.themes).toBeDefined();
    expect(localValues[assetKey]).toMatchObject({ imageDataUrl: "data:image/png;base64,AA==" });
    expect(saved.themes[0].cursorSkin.states.default.image.kind).toBe("dataUrl");

    await repository.writeEditorState({ themeId: "theme-a" });
    await repository.writeRecentCursorAsset({ imageDataUrl: "data:image/png;base64,AA==" });
    await repository.writeDiagnosticDebugFlag(true);
    expect(await repository.readEditorState()).toEqual({ themeId: "theme-a" });
    expect(await repository.readRecentCursorAssets()).toHaveLength(1);
    expect(await repository.readDiagnosticDebugFlag()).toBe(true);
  });

  it("contains async Chrome config subscription failures", async () => {
    const { chromeApi, listeners } = createChromeApi();
    const repository = createChromeWorkbenchRepository(chromeApi, codec);
    const error = new Error("storage unavailable");
    vi.mocked(chromeApi.storage.local.get).mockRejectedValueOnce(error);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const unsubscribe = repository.subscribeConfig(() => {});
    for (const listener of listeners) {
      listener({ [CONFIG_STORAGE_KEY]: { newValue: {} } }, "local");
    }

    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "[cursordance] repository subscription failed:",
        error,
      );
    });
    unsubscribe();
    consoleError.mockRestore();
  });
});

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
