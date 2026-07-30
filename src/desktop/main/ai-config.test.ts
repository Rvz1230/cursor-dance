// ai-config 单测
//
// 重点验证 safeStorage 加密 / 退化路径、settings 写入后同步 process.env、
// readSettingsView 不回流明文 apiKey。

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("electron-store", () => ({
  default: class {
    private data = new Map<string, unknown>();
    get(key: string, fallback?: unknown) {
      return this.data.has(key) ? this.data.get(key) : fallback;
    }
    set(key: string, value: unknown) {
      this.data.set(key, value);
    }
    delete(key: string) {
      this.data.delete(key);
    }
  },
}));

const electronMock = vi.hoisted(() => ({
  encryptionAvailable: true,
}));

vi.mock("electron", () => ({
  app: { isReady: () => true },
  safeStorage: {
    isEncryptionAvailable: () => electronMock.encryptionAvailable,
    // mock 加密：在前面追加固定前缀，方便观察 round-trip
    encryptString: (value: string) => Buffer.from("enc:" + value, "utf8"),
    decryptString: (buf: Buffer) => {
      const text = buf.toString("utf8");
      if (!text.startsWith("enc:")) throw new Error("not encrypted");
      return text.slice(4);
    },
  },
}));

import {
  readSettings,
  readSettingsView,
  writeSettings,
  syncEnvFromSettings,
  __testing__,
} from "./ai-config";

beforeEach(() => {
  __testing__.reset();
  electronMock.encryptionAvailable = true;
  // 清掉之前测试可能注入的 env，避免互串
  for (const key of [
    "CURSORDANCE_AI_API_KEY",
    "OPENAI_API_KEY",
    "CURSORDANCE_AI_API_BASE_URL",
    "CURSORDANCE_AI_MODEL",
    "CURSORDANCE_AI_API_MODE",
  ]) {
    delete process.env[key];
  }
});

describe("ai-config", () => {
  it("默认空 settings：apiKey 空、视图 hasApiKey=false", () => {
    expect(readSettings().apiKey).toBe("");
    expect(readSettingsView().hasApiKey).toBe(false);
  });

  it("写入 apiKey 后通过 safeStorage 加密保存，读出可还原", () => {
    writeSettings({ apiKey: "sk-abc123" });
    expect(readSettings().apiKey).toBe("sk-abc123");
    expect(readSettingsView().hasApiKey).toBe(true);
  });

  it("readSettingsView 不返回 apiKey 明文", () => {
    writeSettings({ apiKey: "sk-secret" });
    const view = readSettingsView();
    expect(Object.prototype.hasOwnProperty.call(view, "apiKey")).toBe(false);
  });

  it("apiKey 传空串 = 清除（hasApiKey 回到 false）", () => {
    writeSettings({ apiKey: "sk-abc" });
    expect(readSettingsView().hasApiKey).toBe(true);
    writeSettings({ apiKey: "" });
    expect(readSettingsView().hasApiKey).toBe(false);
    expect(readSettings().apiKey).toBe("");
  });

  it("safeStorage 不可用时退化为明文存储", () => {
    electronMock.encryptionAvailable = false;
    writeSettings({ apiKey: "sk-plain" });
    expect(readSettings().apiKey).toBe("sk-plain");
    expect(readSettingsView().hasApiKey).toBe(true);
  });

  it("baseUrl / model / apiMode 部分更新不破坏其他字段", () => {
    writeSettings({ baseUrl: "https://example.com/v1", model: "gpt-x", apiKey: "sk-1" });
    writeSettings({ model: "gpt-y" }); // 仅改 model
    const settings = readSettings();
    expect(settings.baseUrl).toBe("https://example.com/v1");
    expect(settings.model).toBe("gpt-y");
    expect(settings.apiKey).toBe("sk-1");
  });

  it("写入 settings 后 syncEnvFromSettings 自动把 apiKey/baseUrl/model 注入 process.env", () => {
    writeSettings({
      apiKey: "sk-env",
      baseUrl: "https://api.example.com/v1",
      model: "demo-model",
      apiMode: "chat_completions",
    });
    // writeSettings 自身就会调一次 syncEnvFromSettings；单独再调一次也无副作用
    syncEnvFromSettings();
    expect(process.env.CURSORDANCE_AI_API_KEY).toBe("sk-env");
    expect(process.env.OPENAI_API_KEY).toBe("sk-env");
    expect(process.env.CURSORDANCE_AI_API_BASE_URL).toBe("https://api.example.com/v1");
    expect(process.env.CURSORDANCE_AI_MODEL).toBe("demo-model");
    expect(process.env.CURSORDANCE_AI_API_MODE).toBe("chat_completions");
  });

  it("清除 apiKey 后从 process.env 同步删除", () => {
    writeSettings({ apiKey: "sk-temp" });
    expect(process.env.CURSORDANCE_AI_API_KEY).toBe("sk-temp");
    writeSettings({ apiKey: "" });
    expect(process.env.CURSORDANCE_AI_API_KEY).toBeUndefined();
    expect(process.env.OPENAI_API_KEY).toBeUndefined();
  });

  it("切换 safeStorage 启用状态时不会同时留下两个槽位", () => {
    // 第一次：加密保存
    electronMock.encryptionAvailable = true;
    writeSettings({ apiKey: "sk-1" });
    expect(readSettings().apiKey).toBe("sk-1");
    // 第二次：safeStorage 不可用，写入新值会清掉密文槽位再写明文
    electronMock.encryptionAvailable = false;
    writeSettings({ apiKey: "sk-2" });
    expect(readSettings().apiKey).toBe("sk-2");
    // 再切回加密：写入新值时清掉明文槽位
    electronMock.encryptionAvailable = true;
    writeSettings({ apiKey: "sk-3" });
    expect(readSettings().apiKey).toBe("sk-3");
  });
});
