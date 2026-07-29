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
import type { AiRuntimeConfig } from "../../shared/desktop-ipc-contracts";
import {
  readSettingsView,
  writeSettings,
  type AiUserSettingsView,
} from "./ai-config";
import {
  getEmbeddedAiAgentEndpoint,
  getEmbeddedAiServerEndpoint,
  getEmbeddedAiServerStreamEndpoint,
  startEmbeddedAiServer,
} from "./api-server";
import { validateAiSettingsPatch } from "./ipc-contracts";
import { assertIpcSender } from "./ipc-security";

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
  ipcMain.handle(AI_GET_RUNTIME_CONFIG, (event): Promise<AiRuntimeConfig> => {
    assertIpcSender(event, AI_GET_RUNTIME_CONFIG);
    return getRuntimeConfig();
  });

  ipcMain.handle(AI_GET_USER_SETTINGS, (event): AiUserSettingsView => {
    assertIpcSender(event, AI_GET_USER_SETTINGS);
    return readSettingsView();
  });

  ipcMain.handle(AI_SET_USER_SETTINGS, (event, payload: unknown): AiUserSettingsView => {
    assertIpcSender(event, AI_SET_USER_SETTINGS);
    return writeSettings(validateAiSettingsPatch(payload));
  });
}

export function unregisterAiIpc(): void {
  ipcMain.removeHandler(AI_GET_RUNTIME_CONFIG);
  ipcMain.removeHandler(AI_GET_USER_SETTINGS);
  ipcMain.removeHandler(AI_SET_USER_SETTINGS);
}
