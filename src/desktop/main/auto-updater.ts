import { app } from "electron";
import pkg from "electron-updater";
import type { DesktopUpdateState } from "../../shared/desktop-update";

const { autoUpdater } = pkg;
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const MAX_ERROR_MESSAGE_LENGTH = 500;

type UpdatePublisher = (state: DesktopUpdateState) => void;
type UpdaterListener = (payload?: unknown) => void;
type UpdaterEventName =
  | "error"
  | "checking-for-update"
  | "update-available"
  | "update-not-available"
  | "download-progress"
  | "update-downloaded";

export interface AutoUpdateController {
  getState(): DesktopUpdateState;
  checkForUpdates(): Promise<DesktopUpdateState>;
  downloadUpdate(): Promise<DesktopUpdateState>;
  installUpdate(): void;
  stop(): void;
}

interface RegisterOptions {
  intervalMs?: number;
  isPackaged?: boolean;
  publish?: UpdatePublisher;
}

let intervalHandle: NodeJS.Timeout | null = null;
let registered = false;
let publisher: UpdatePublisher | null = null;
let currentState: DesktopUpdateState = { status: "unsupported" };
let checkPromise: Promise<DesktopUpdateState> | null = null;
let lifecycleToken = 0;
const updaterListeners: Array<[event: UpdaterEventName, listener: UpdaterListener]> = [];

function getCurrentState(): DesktopUpdateState {
  return currentState;
}

function publishState(nextState: DesktopUpdateState): DesktopUpdateState {
  currentState = nextState;
  publisher?.(nextState);
  return nextState;
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, MAX_ERROR_MESSAGE_LENGTH) || "更新操作失败";
}

function readVersion(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || !("version" in payload)) return undefined;
  const version = (payload as { version?: unknown }).version;
  return typeof version === "string" && version.length <= 128 ? version : undefined;
}

function readProgress(payload: unknown): number | undefined {
  if (!payload || typeof payload !== "object" || !("percent" in payload)) return undefined;
  const percent = (payload as { percent?: unknown }).percent;
  if (typeof percent !== "number" || !Number.isFinite(percent)) return undefined;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

function listen(event: UpdaterEventName, listener: UpdaterListener): void {
  autoUpdater.on(event, listener);
  updaterListeners.push([event, listener]);
}

async function checkForUpdates(): Promise<DesktopUpdateState> {
  if (!registered) return currentState;
  if (currentState.status === "downloading" || currentState.status === "downloaded") {
    return currentState;
  }
  if (checkPromise !== null) return checkPromise;

  const operationToken = lifecycleToken;
  publishState({ status: "checking" });
  const pendingCheck = Promise.resolve(autoUpdater.checkForUpdates())
    .then(() => {
      if (registered && operationToken === lifecycleToken && currentState.status === "checking") {
        return publishState({ status: "idle", checkedAt: Date.now() });
      }
      return currentState;
    })
    .catch((error: unknown) => {
      if (!registered || operationToken !== lifecycleToken) return currentState;
      console.error("[auto-updater] check failed:", error);
      return publishState({ status: "error", message: errorMessage(error) });
    })
    .finally(() => {
      if (checkPromise === pendingCheck) checkPromise = null;
    });
  checkPromise = pendingCheck;
  return pendingCheck;
}

async function downloadUpdate(): Promise<DesktopUpdateState> {
  if (!registered || currentState.status !== "available") return currentState;
  const operationToken = lifecycleToken;
  const version = currentState.version;
  publishState({ status: "downloading", version, percent: 0 });
  try {
    await autoUpdater.downloadUpdate();
    if (registered && operationToken === lifecycleToken && getCurrentState().status === "downloading") {
      return publishState({ status: "downloaded", version });
    }
  } catch (error) {
    if (registered && operationToken === lifecycleToken) {
      console.error("[auto-updater] download failed:", error);
      return publishState({ status: "error", version, message: errorMessage(error) });
    }
  }
  return currentState;
}

function installUpdate(): void {
  if (!registered || currentState.status !== "downloaded") return;
  try {
    autoUpdater.quitAndInstall(false, true);
  } catch (error) {
    console.error("[auto-updater] install failed:", error);
    publishState({
      status: "error",
      version: currentState.version,
      message: errorMessage(error),
    });
  }
}

function stopAutoUpdater(): void {
  lifecycleToken += 1;
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  for (const [event, listener] of updaterListeners.splice(0)) {
    autoUpdater.off(event, listener);
  }
  registered = false;
  publisher = null;
  checkPromise = null;
}

const controller: AutoUpdateController = {
  getState: getCurrentState,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  stop: stopAutoUpdater,
};

export function registerAutoUpdater(options: RegisterOptions = {}): AutoUpdateController {
  if (registered) {
    console.warn("[auto-updater] already registered; ignoring repeat call");
    return controller;
  }

  publisher = options.publish ?? null;
  const isPackaged = options.isPackaged ?? app.isPackaged;
  if (!isPackaged) {
    publishState({ status: "unsupported" });
    console.log("[auto-updater] skipped (app not packaged)");
    return controller;
  }

  registered = true;
  lifecycleToken += 1;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  publishState({ status: "idle" });

  listen("error", (error) => {
    console.error("[auto-updater] error:", error);
    publishState({
      status: "error",
      version: currentState.version,
      message: errorMessage(error),
    });
  });
  listen("checking-for-update", () => {
    publishState({ status: "checking" });
  });
  listen("update-available", (info) => {
    publishState({ status: "available", version: readVersion(info), checkedAt: Date.now() });
  });
  listen("update-not-available", (info) => {
    publishState({ status: "up-to-date", version: readVersion(info), checkedAt: Date.now() });
  });
  listen("download-progress", (progress) => {
    publishState({
      status: "downloading",
      version: currentState.version,
      percent: readProgress(progress),
    });
  });
  listen("update-downloaded", (info) => {
    publishState({ status: "downloaded", version: readVersion(info) ?? currentState.version });
  });

  void checkForUpdates();
  intervalHandle = setInterval(() => {
    void checkForUpdates();
  }, options.intervalMs ?? FOUR_HOURS_MS);
  return controller;
}

export const __testing__ = {
  reset(): void {
    stopAutoUpdater();
    currentState = { status: "unsupported" };
  },
  isRegistered: () => registered,
  hasInterval: () => intervalHandle !== null,
};
