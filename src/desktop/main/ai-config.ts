// 任务 5.0：AI 用户设置 + safeStorage 加密 API key
//
// 职责：
//   - 持久化用户 AI 配置：apiKey（加密）、baseUrl、model、apiMode
//   - 写入后同步到 process.env，让嵌入的 cursor-dance-api 立即用到最新值
//   - 读出明文给 renderer 时只返回「已配置 / 未配置」flag，不回流 apiKey 明文
//
// 设计决策：
//   - 用独立 store name "cursordance-ai"，与 cursordance.config / cursordance-app 分开。
//     主题数据被导出 / 同步时不会带走 API key；删除主题不会丢失 key。
//   - safeStorage 在 macOS Keychain / Windows DPAPI / Linux libsecret 落地。
//     不可用时（headless / 没有 keyring）退化为明文存储但记日志，避免主进程崩溃。
//   - apiKey 永远不返回给 renderer，只暴露 hasApiKey: boolean。需要重置就再写一次空串。

import { safeStorage } from "electron";
import ElectronStore from "electron-store";

const STORE_NAME = "cursordance-ai";

// 持久化字段 —— 明文。apiKey 字段单独存 base64 密文。
const FIELD_API_KEY_CIPHERTEXT = "apiKeyCipher"; // base64 of safeStorage.encryptString
const FIELD_API_KEY_PLAINTEXT_FALLBACK = "apiKeyPlain"; // 仅当 safeStorage 不可用时退化使用
const FIELD_BASE_URL = "baseUrl";
const FIELD_MODEL = "model";
const FIELD_API_MODE = "apiMode"; // chat_completions / responses

const ENV_KEYS = {
  apiKey: ["CURSORDANCE_AI_API_KEY", "OPENAI_API_KEY"],
  baseUrl: ["CURSORDANCE_AI_API_BASE_URL"],
  model: ["CURSORDANCE_AI_MODEL"],
  apiMode: ["CURSORDANCE_AI_API_MODE"],
};

let store: ElectronStore | null = null;

function ensureStore(): ElectronStore {
  if (!store) {
    store = new ElectronStore({ name: STORE_NAME });
  }
  return store;
}

function isEncryptionAvailable(): boolean {
  try {
    return typeof safeStorage?.isEncryptionAvailable === "function" && safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function readApiKey(): string {
  const s = ensureStore();
  if (isEncryptionAvailable()) {
    const cipherB64 = s.get(FIELD_API_KEY_CIPHERTEXT, "") as string;
    if (typeof cipherB64 === "string" && cipherB64.length) {
      try {
        const buf = Buffer.from(cipherB64, "base64");
        return safeStorage.decryptString(buf);
      } catch (error) {
        console.error("[cursordance] failed to decrypt AI API key:", error);
        return "";
      }
    }
  }
  // 退化路径：safeStorage 不可用时存明文。读出来照样直接用。
  const plain = s.get(FIELD_API_KEY_PLAINTEXT_FALLBACK, "") as string;
  return typeof plain === "string" ? plain : "";
}

function writeApiKey(value: string): void {
  const s = ensureStore();
  // 写之前先清干净两个槽位，避免一次启用 / 一次禁用 keyring 导致两个槽都有值。
  s.delete(FIELD_API_KEY_CIPHERTEXT);
  s.delete(FIELD_API_KEY_PLAINTEXT_FALLBACK);
  if (!value) return;
  if (isEncryptionAvailable()) {
    try {
      const cipher = safeStorage.encryptString(value);
      s.set(FIELD_API_KEY_CIPHERTEXT, cipher.toString("base64"));
      return;
    } catch (error) {
      console.error("[cursordance] failed to encrypt AI API key, falling back to plaintext:", error);
    }
  }
  s.set(FIELD_API_KEY_PLAINTEXT_FALLBACK, value);
}

export type AiUserSettings = {
  apiKey: string;
  baseUrl: string;
  model: string;
  apiMode: string;
};

export type AiUserSettingsView = Omit<AiUserSettings, "apiKey"> & {
  hasApiKey: boolean;
};

export function readSettings(): AiUserSettings {
  const s = ensureStore();
  return {
    apiKey: readApiKey(),
    baseUrl: (s.get(FIELD_BASE_URL, "") as string) || "",
    model: (s.get(FIELD_MODEL, "") as string) || "",
    apiMode: (s.get(FIELD_API_MODE, "") as string) || "",
  };
}

export function readSettingsView(): AiUserSettingsView {
  const settings = readSettings();
  return {
    hasApiKey: settings.apiKey.length > 0,
    baseUrl: settings.baseUrl,
    model: settings.model,
    apiMode: settings.apiMode,
  };
}

// renderer 写入。partial：只更新提供的字段，其余保持。apiKey 传空串 = 清除。
export function writeSettings(patch: Partial<AiUserSettings>): AiUserSettingsView {
  const s = ensureStore();
  if (Object.prototype.hasOwnProperty.call(patch, "apiKey")) {
    writeApiKey(typeof patch.apiKey === "string" ? patch.apiKey : "");
  }
  if (Object.prototype.hasOwnProperty.call(patch, "baseUrl")) {
    s.set(FIELD_BASE_URL, typeof patch.baseUrl === "string" ? patch.baseUrl : "");
  }
  if (Object.prototype.hasOwnProperty.call(patch, "model")) {
    s.set(FIELD_MODEL, typeof patch.model === "string" ? patch.model : "");
  }
  if (Object.prototype.hasOwnProperty.call(patch, "apiMode")) {
    s.set(FIELD_API_MODE, typeof patch.apiMode === "string" ? patch.apiMode : "");
  }
  syncEnvFromSettings();
  return readSettingsView();
}

// 把当前 settings 同步到 process.env，让嵌入的 cursor-dance-api 进程内读到最新值。
// model-provider.mjs 里 getApiConfig(env) 默认 env=process.env，所以无需重启 server。
export function syncEnvFromSettings(): void {
  const settings = readSettings();
  setEnvAll(ENV_KEYS.apiKey, settings.apiKey);
  setEnvAll(ENV_KEYS.baseUrl, settings.baseUrl);
  setEnvAll(ENV_KEYS.model, settings.model);
  setEnvAll(ENV_KEYS.apiMode, settings.apiMode);
}

function setEnvAll(keys: string[], value: string): void {
  for (const key of keys) {
    if (value) {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
}

export const __testing__ = {
  reset(): void {
    store = null;
  },
  injectStore(stub: ElectronStore | null): void {
    store = stub;
  },
};
