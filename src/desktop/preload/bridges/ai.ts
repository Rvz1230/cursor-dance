import {
  AI_GET_RUNTIME_CONFIG,
  AI_GET_USER_SETTINGS,
  AI_SET_USER_SETTINGS,
} from "../../../shared/ipc-channels";
import type {
  AiRuntimeConfig,
  AiUserSettingsPatch,
  AiUserSettingsView,
} from "../../../shared/desktop-ipc-contracts";
import { invokeDesktop } from "./typed-invoke";

export function createAiBridge() {
  return {
    async getRuntimeConfig(): Promise<AiRuntimeConfig> {
      return invokeDesktop(AI_GET_RUNTIME_CONFIG);
    },
    async getSettings(): Promise<AiUserSettingsView> {
      return invokeDesktop(AI_GET_USER_SETTINGS);
    },
    async setSettings(patch: AiUserSettingsPatch): Promise<AiUserSettingsView> {
      return invokeDesktop(AI_SET_USER_SETTINGS, patch);
    },
  };
}
