import type { ActiveWindowSnapshot } from "./app-rules";
import {
  AI_CANCEL_REQUEST,
  AI_CREATE_PROPOSAL_STREAM,
  AI_GET_USER_SETTINGS,
  AI_RUN_AGENT,
  AI_SET_USER_SETTINGS,
  APP_GET_ACTIVE_WINDOW,
  APP_ACCESSIBILITY_GET_STATE,
  APP_ACCESSIBILITY_REQUEST,
  APP_LIST_INSTALLED_APPLICATIONS,
  APP_PICK_WINDOW,
  APP_GET_FIRST_RUN,
  APP_MARK_FIRST_RUN_COMPLETE,
  APP_OPEN_EXTERNAL,
  APP_UPDATE_CHECK,
  APP_UPDATE_DOWNLOAD,
  APP_UPDATE_GET_STATE,
  APP_UPDATE_INSTALL,
  CURSOR_VISIBILITY_SET_HIDDEN,
  DIALOG_OPEN_THEME_FILE,
  DIALOG_SAVE_THEME_FILE,
  STORE_CLEAR_LIVE_PREVIEW,
  STORE_GET,
  STORE_GET_LIVE_PREVIEW,
  STORE_SET,
  STORE_SET_LIVE_PREVIEW,
  WINDOW_CLOSE,
  WINDOW_GET_STATE,
  WINDOW_MINIMIZE,
  WINDOW_TOGGLE_MAXIMIZE,
} from "./ipc-channels";
import type { DesktopUpdateState } from "./desktop-update";
import type { DesktopAccessibilityState } from "./desktop-accessibility";

export type SaveThemeFileRequest = {
  defaultFileName: string;
  contents: string;
};

export type SaveThemeFileResult =
  | { ok: true; canceled: false; filePath: string }
  | { ok: true; canceled: true }
  | { ok: false; canceled: false; error: string };

export type OpenThemeFileResult =
  | { ok: true; canceled: false; filePath: string; contents: string }
  | { ok: true; canceled: true }
  | { ok: false; canceled: false; error: string };

export type WindowStateSnapshot = {
  isMaximized: boolean;
  isFullScreen: boolean;
};

export type InstalledApplication = {
  name: string;
  processName: string;
  bundleId?: string;
  iconDataUrl?: string;
};

export type PickWindowResult =
  | { status: "picked"; snapshot: ActiveWindowSnapshot }
  | { status: "cancelled" }
  | { status: "failed"; message: string };

export type AiUserSettingsView = {
  hasApiKey: boolean;
  baseUrl: string;
  model: string;
  apiMode: string;
};

export type AiUserSettingsPatch = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  apiMode?: string;
};

type AiTransportPayload = Record<string, unknown>;

export type AiTransportResponse = {
  status: number;
  body: Record<string, unknown>;
};

export type AiStreamRequest = {
  requestId: string;
  payload: AiTransportPayload;
};

type AiCancelRequest = {
  requestId: string;
};

export type AiRequestEvent = {
  requestId: string;
  type: string;
  data: unknown;
};

type InvokeContract<Request, Response> = {
  request: Request;
  response: Response;
};

interface DesktopIpcInvokeContract {
  [STORE_GET]: InvokeContract<void, unknown | null>;
  [STORE_SET]: InvokeContract<unknown, unknown>;
  [STORE_GET_LIVE_PREVIEW]: InvokeContract<void, unknown | null>;
  [STORE_SET_LIVE_PREVIEW]: InvokeContract<unknown, unknown>;
  [STORE_CLEAR_LIVE_PREVIEW]: InvokeContract<void, void>;
  [DIALOG_SAVE_THEME_FILE]: InvokeContract<SaveThemeFileRequest, SaveThemeFileResult>;
  [DIALOG_OPEN_THEME_FILE]: InvokeContract<void, OpenThemeFileResult>;
  [APP_GET_ACTIVE_WINDOW]: InvokeContract<void, ActiveWindowSnapshot>;
  [APP_ACCESSIBILITY_GET_STATE]: InvokeContract<void, DesktopAccessibilityState>;
  [APP_ACCESSIBILITY_REQUEST]: InvokeContract<void, DesktopAccessibilityState>;
  [APP_LIST_INSTALLED_APPLICATIONS]: InvokeContract<void, InstalledApplication[]>;
  [APP_PICK_WINDOW]: InvokeContract<void, PickWindowResult>;
  [APP_GET_FIRST_RUN]: InvokeContract<void, boolean>;
  [APP_MARK_FIRST_RUN_COMPLETE]: InvokeContract<void, void>;
  [APP_OPEN_EXTERNAL]: InvokeContract<string, { ok: boolean; error?: string }>;
  [APP_UPDATE_GET_STATE]: InvokeContract<void, DesktopUpdateState>;
  [APP_UPDATE_CHECK]: InvokeContract<void, DesktopUpdateState>;
  [APP_UPDATE_DOWNLOAD]: InvokeContract<void, DesktopUpdateState>;
  [APP_UPDATE_INSTALL]: InvokeContract<void, void>;
  [WINDOW_MINIMIZE]: InvokeContract<void, void>;
  [WINDOW_TOGGLE_MAXIMIZE]: InvokeContract<void, void>;
  [WINDOW_CLOSE]: InvokeContract<void, void>;
  [WINDOW_GET_STATE]: InvokeContract<void, WindowStateSnapshot>;
  [AI_GET_USER_SETTINGS]: InvokeContract<void, AiUserSettingsView>;
  [AI_SET_USER_SETTINGS]: InvokeContract<AiUserSettingsPatch, AiUserSettingsView>;
  [AI_CREATE_PROPOSAL_STREAM]: InvokeContract<AiStreamRequest, AiTransportResponse>;
  [AI_RUN_AGENT]: InvokeContract<AiStreamRequest, AiTransportResponse>;
  [AI_CANCEL_REQUEST]: InvokeContract<AiCancelRequest, void>;
  [CURSOR_VISIBILITY_SET_HIDDEN]: InvokeContract<boolean, void>;
}

export type DesktopIpcInvokeChannel = keyof DesktopIpcInvokeContract;
export type DesktopIpcRequest<C extends DesktopIpcInvokeChannel> = DesktopIpcInvokeContract[C]["request"];
export type DesktopIpcResponse<C extends DesktopIpcInvokeChannel> = DesktopIpcInvokeContract[C]["response"];
