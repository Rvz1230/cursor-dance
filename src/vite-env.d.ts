/// <reference types="vite/client" />

declare module '*.css' {
  const content: string
  export default content
}

interface Chrome {
  storage: {
    local: {
      get: (keys: string | string[] | Record<string, unknown> | null) => Promise<Record<string, any>>
      set: (items: Record<string, unknown>) => Promise<void>
      remove: (keys: string | string[]) => Promise<void>
      clear: () => Promise<void>
    }
    sync: {
      get: (keys: string | string[] | Record<string, unknown> | null) => Promise<Record<string, any>>
      set: (items: Record<string, unknown>) => Promise<void>
    }
    session: {
      get: (keys: string | string[] | Record<string, unknown> | null) => Promise<Record<string, any>>
      set: (items: Record<string, unknown>) => Promise<void>
      remove: (keys: string | string[]) => Promise<void>
      setAccessLevel?: (options: { accessLevel: string }) => Promise<void>
    }
    onChanged: {
      addListener: (callback: (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, areaName: string) => void) => void
      removeListener: (callback: (...args: unknown[]) => void) => void
    }
  }
  runtime: {
    lastError?: { message: string }
    id?: string
    sendMessage: (message: unknown, responseCallback?: (response: unknown) => void) => void
    onMessage: {
      addListener: (callback: (message: unknown, sender: unknown, sendResponse: (response?: unknown) => void) => void) => void
    }
    openOptionsPage: () => void
  }
  tabs: {
    query: (queryInfo: Record<string, unknown>) => Promise<chrome.tabs.Tab[]>
    create: (createProperties: Record<string, unknown>) => void
    sendMessage: (tabId: number, message: unknown) => Promise<unknown>
  }
}

type CursorDanceThemeRecord = {
  id?: string
  name?: string
  actionConfigs?: object
  cursorBindings?: object
  cursorSkin?: {
    states?: Readonly<Record<string, {
      image?: {
        kind?: string
        assetId?: string
        dataUrl?: string
      }
    }>>
  }
  keyFeedbackConfig?: object
  atmosphere?: object
}

type CursorDanceConfigRecord = {
  schemaVersion?: number
  enabled?: boolean
  activeThemeId?: string
  themes?: readonly CursorDanceThemeRecord[]
  contextRules?: readonly unknown[]
  performance?: object
}

interface Window {
  chrome?: Chrome
  cursorDanceStorage?: CursorDanceStorageBridge
  cursorDanceDialog?: CursorDanceDialogBridge
  cursorDanceWindow?: CursorDanceWindowBridge
  cursorDanceApp?: CursorDanceAppBridge
  cursorDanceAi?: CursorDanceAiBridge
  electronAPI?: {
    platform: NodeJS.Platform
    capabilities: import("./shared/desktop-capabilities").DesktopCapabilities
  }
}

interface CursorDanceStorageBridge {
  getConfig: () => Promise<unknown | null>
  setConfig: (config: unknown) => Promise<unknown>
  getLivePreview: () => Promise<unknown | null>
  setLivePreview: (config: unknown) => Promise<unknown>
  clearLivePreview: () => Promise<void>
  onChange: (callback: (config: unknown) => void) => () => void
  onLivePreviewChange: (callback: (config: unknown | null) => void) => () => void
}

interface CursorDanceDialogSaveRequest {
  defaultFileName: string
  contents: string
}

type CursorDanceDialogSaveResult =
  | { ok: true; canceled: false; filePath: string }
  | { ok: true; canceled: true }
  | { ok: false; canceled: false; error: string }

type CursorDanceDialogOpenResult =
  | { ok: true; canceled: false; filePath: string; contents: string }
  | { ok: true; canceled: true }
  | { ok: false; canceled: false; error: string }

interface CursorDanceDialogBridge {
  saveThemeFile: (request: CursorDanceDialogSaveRequest) => Promise<CursorDanceDialogSaveResult>
  openThemeFile: () => Promise<CursorDanceDialogOpenResult>
}

interface CursorDanceWindowStateSnapshot {
  isMaximized: boolean
  isFullScreen: boolean
}

interface CursorDanceWindowBridge {
  platform: NodeJS.Platform
  minimize: () => Promise<void>
  toggleMaximize: () => Promise<void>
  close: () => Promise<void>
  getState: () => Promise<CursorDanceWindowStateSnapshot>
  onStateChanged: (callback: (state: CursorDanceWindowStateSnapshot) => void) => () => void
}

interface CursorDanceAppActiveWindowAuthorized {
  authorized: true
  owner: { name: string; bundleId?: string }
  title: string
  processName: string
}

interface CursorDanceAppActiveWindowUnauthorized {
  authorized: false
  message: string
}

interface CursorDanceAppBridge {
  getActiveWindow: () => Promise<
    CursorDanceAppActiveWindowAuthorized | CursorDanceAppActiveWindowUnauthorized
  >
  onActiveWindowChanged: (
    callback: (snapshot: CursorDanceAppActiveWindowAuthorized | CursorDanceAppActiveWindowUnauthorized) => void
  ) => () => void
  getFirstRun: () => Promise<boolean>
  markFirstRunComplete: () => Promise<void>
  openExternal: (target: string) => Promise<{ ok: boolean; error?: string }>
}

interface CursorDanceAiSettingsView {
  hasApiKey: boolean
  baseUrl: string
  model: string
  apiMode: string
}

interface CursorDanceAiSettingsPatch {
  apiKey?: string
  baseUrl?: string
  model?: string
  apiMode?: string
}

interface CursorDanceAiBridge {
  getSettings: () => Promise<CursorDanceAiSettingsView>
  setSettings: (patch: CursorDanceAiSettingsPatch) => Promise<CursorDanceAiSettingsView>
  createProposalStream: (request: { requestId: string; payload: Record<string, unknown> }) => Promise<{ status: number; body: Record<string, unknown> }>
  runAgent: (request: { requestId: string; payload: Record<string, unknown> }) => Promise<{ status: number; body: Record<string, unknown> }>
  cancelRequest: (requestId: string) => Promise<void>
  onRequestEvent: (callback: (event: { requestId: string; type: string; data: unknown }) => void) => () => void
}
