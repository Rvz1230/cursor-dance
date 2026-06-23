// 任务 5.0：AI 服务相关 IPC
//
// 注册三个通道：
//   - AI_GET_RUNTIME_CONFIG：renderer 启动时拉嵌入服务的 endpoint，注入 globalThis。
//   - AI_GET_USER_SETTINGS / AI_SET_USER_SETTINGS：设置面板的读 / 写。
//
// 职责边界：
//   - 这里只做 IPC 转发，不做端口探测 / 加密——委托给 api-server / ai-config。
//   - 写入设置后立即同步 process.env（ai-config.writeSettings 已内置 syncEnvFromSettings），
//     不需要重启嵌入服务。

import { ipcMain } from "electron";
import {
  AI_GET_RUNTIME_CONFIG,
  AI_GET_USER_SETTINGS,
  AI_SET_USER_SETTINGS,
} from "../../shared/ipc-channels";
import {
  readSettingsView,
  writeSettings,
  type AiUserSettings,
  type AiUserSettingsView,
} from "./ai-config";
import {
  getEmbeddedAiAgentEndpoint,
  getEmbeddedAiServerEndpoint,
  getEmbeddedAiServerStreamEndpoint,
  startEmbeddedAiServer,
} from "./api-server";

export type AiRuntimeConfig = {
  endpoint: string | null;
  streamEndpoint: string | null;
  agentEndpoint: string | null;
  // 嵌入服务跑在本机回环，accessToken 在内嵌场景没有意义；保留字段方便以后接入远程后端。
  accessToken: string;
};

async function getRuntimeConfig(): Promise<AiRuntimeConfig> {
  await startEmbeddedAiServer();
  return {
    endpoint: getEmbeddedAiServerEndpoint(),
    streamEndpoint: getEmbeddedAiServerStreamEndpoint(),
    agentEndpoint: getEmbeddedAiAgentEndpoint(),
    accessToken: "",
  };
}

export function registerAiIpc(): void {
  ipcMain.handle(AI_GET_RUNTIME_CONFIG, (): Promise<AiRuntimeConfig> => getRuntimeConfig());

  ipcMain.handle(AI_GET_USER_SETTINGS, (): AiUserSettingsView => readSettingsView());

  ipcMain.handle(AI_SET_USER_SETTINGS, (_event, payload: unknown): AiUserSettingsView => {
    const patch: Partial<AiUserSettings> = {};
    if (payload && typeof payload === "object") {
      const p = payload as Record<string, unknown>;
      if (typeof p.apiKey === "string") patch.apiKey = p.apiKey;
      if (typeof p.baseUrl === "string") patch.baseUrl = p.baseUrl;
      if (typeof p.model === "string") patch.model = p.model;
      if (typeof p.apiMode === "string") patch.apiMode = p.apiMode;
      if (typeof p.accessToken === "string") patch.accessToken = p.accessToken;
    }
    return writeSettings(patch);
  });
}

export function unregisterAiIpc(): void {
  ipcMain.removeHandler(AI_GET_RUNTIME_CONFIG);
  ipcMain.removeHandler(AI_GET_USER_SETTINGS);
  ipcMain.removeHandler(AI_SET_USER_SETTINGS);
}
