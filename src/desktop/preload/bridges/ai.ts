import {
  AI_CANCEL_REQUEST,
  AI_CREATE_PROPOSAL,
  AI_CREATE_PROPOSAL_STREAM,
  AI_GET_USER_SETTINGS,
  AI_REQUEST_EVENT,
  AI_RUN_AGENT,
  AI_SET_USER_SETTINGS,
} from "../../../shared/ipc-channels";
import type {
  AiRequestEvent,
  AiStreamRequest,
  AiTransportPayload,
  AiTransportResponse,
  AiUserSettingsPatch,
  AiUserSettingsView,
} from "../../../shared/desktop-ipc-contracts";
import { createIpcSubscription } from "./ipc-subscription";
import { invokeDesktop } from "./typed-invoke";

export function createAiBridge() {
  const requestEvents = createIpcSubscription<AiRequestEvent>(AI_REQUEST_EVENT);
  return {
    async getSettings(): Promise<AiUserSettingsView> {
      return invokeDesktop(AI_GET_USER_SETTINGS);
    },
    async setSettings(patch: AiUserSettingsPatch): Promise<AiUserSettingsView> {
      return invokeDesktop(AI_SET_USER_SETTINGS, patch);
    },
    async createProposal(payload: AiTransportPayload): Promise<AiTransportResponse> {
      return invokeDesktop(AI_CREATE_PROPOSAL, payload);
    },
    async createProposalStream(request: AiStreamRequest): Promise<AiTransportResponse> {
      return invokeDesktop(AI_CREATE_PROPOSAL_STREAM, request);
    },
    async runAgent(request: AiStreamRequest): Promise<AiTransportResponse> {
      return invokeDesktop(AI_RUN_AGENT, request);
    },
    async cancelRequest(requestId: string): Promise<void> {
      return invokeDesktop(AI_CANCEL_REQUEST, { requestId });
    },
    onRequestEvent: requestEvents.on,
  };
}
