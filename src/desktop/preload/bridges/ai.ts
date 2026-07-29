import { ipcRenderer } from "electron";
import {
  AI_GET_RUNTIME_CONFIG,
  AI_GET_USER_SETTINGS,
  AI_SET_USER_SETTINGS,
} from "../../../shared/ipc-channels";

type AiRuntimeConfig = {
  endpoint: string | null;
  streamEndpoint: string | null;
  agentEndpoint: string | null;
  accessToken: string;
};

type AiUserSettingsView = {
  hasApiKey: boolean;
  baseUrl: string;
  model: string;
  apiMode: string;
  accessToken: string;
};

type AiUserSettingsPatch = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  apiMode?: string;
  accessToken?: string;
};

export function createAiBridge() {
  return {
    async getRuntimeConfig(): Promise<AiRuntimeConfig> {
      return ipcRenderer.invoke(AI_GET_RUNTIME_CONFIG);
    },
    async getSettings(): Promise<AiUserSettingsView> {
      return ipcRenderer.invoke(AI_GET_USER_SETTINGS);
    },
    async setSettings(patch: AiUserSettingsPatch): Promise<AiUserSettingsView> {
      return ipcRenderer.invoke(AI_SET_USER_SETTINGS, patch);
    },
  };
}
