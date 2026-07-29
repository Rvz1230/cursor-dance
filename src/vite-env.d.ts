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

type CursorDanceConfigRecord = Record<string, any>
type CursorDanceConfigRuntime = Record<string, any>

declare var CursorDanceConfigHelpers: CursorDanceConfigRuntime
declare var CursorDanceDefaultConfig: CursorDanceConfigRecord
declare var CursorDanceConfigRuntime: CursorDanceConfigRuntime

interface Window {
  chrome?: Chrome
  cursorDanceStorage?: CursorDanceStorageBridge
  cursorDanceDialog?: CursorDanceDialogBridge
  cursorDanceWindow?: CursorDanceWindowBridge
  cursorDanceApp?: CursorDanceAppBridge
  cursorDanceAi?: CursorDanceAiBridge
  CursorDanceConfigHelpers?: CursorDanceConfigRuntime
  CursorDanceDefaultConfig?: CursorDanceConfigRecord
  CursorDanceConfigRuntime?: CursorDanceConfigRuntime
  electronAPI?: {
    platform: NodeJS.Platform
    capabilities: import("./shared/desktop-capabilities").DesktopCapabilities
  }
}

interface CursorDanceStorageBridge {
  getConfig: () => Promise<unknown | null>
  setConfig: (config: unknown) => Promise<void>
  getLivePreview: () => Promise<unknown | null>
  setLivePreview: (config: unknown) => Promise<void>
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

interface CursorDanceAiRuntimeConfig {
  endpoint: string | null
  streamEndpoint: string | null
  agentEndpoint: string | null
  accessToken: string
}

interface CursorDanceAiSettingsView {
  hasApiKey: boolean
  baseUrl: string
  model: string
  apiMode: string
  accessToken: string
}

interface CursorDanceAiSettingsPatch {
  apiKey?: string
  baseUrl?: string
  model?: string
  apiMode?: string
  accessToken?: string
}

interface CursorDanceAiBridge {
  getRuntimeConfig: () => Promise<CursorDanceAiRuntimeConfig>
  getSettings: () => Promise<CursorDanceAiSettingsView>
  setSettings: (patch: CursorDanceAiSettingsPatch) => Promise<CursorDanceAiSettingsView>
}
