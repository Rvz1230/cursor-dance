/// <reference types="vite/client" />

declare module '*.css' {
  const content: string
  export default content
}

interface Chrome {
  storage: {
    local: {
      get: (keys: string | string[] | Record<string, unknown> | null) => Promise<Record<string, unknown>>
      set: (items: Record<string, unknown>) => Promise<void>
      remove: (keys: string | string[]) => Promise<void>
      clear: () => Promise<void>
    }
    sync: {
      get: (keys: string | string[] | Record<string, unknown> | null) => Promise<Record<string, unknown>>
      set: (items: Record<string, unknown>) => Promise<void>
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
  }
}

interface Window {
  chrome?: Chrome
}
