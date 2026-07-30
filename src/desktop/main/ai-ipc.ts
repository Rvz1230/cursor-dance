import { ipcMain, type IpcMainInvokeEvent } from "electron";
import {
  createAiAgentProposal,
  createAiSchemeProposalStreaming,
} from "../../../cursor-dance-api/src/proposal-service.mjs";
import {
  AI_CANCEL_REQUEST,
  AI_CREATE_PROPOSAL_STREAM,
  AI_GET_USER_SETTINGS,
  AI_REQUEST_EVENT,
  AI_RUN_AGENT,
  AI_SET_USER_SETTINGS,
} from "../../shared/ipc-channels";
import type {
  AiRequestEvent,
  AiTransportResponse,
  AiUserSettingsView,
} from "../../shared/desktop-ipc-contracts";
import {
  readSettingsView,
  syncEnvFromSettings,
  writeSettings,
} from "./ai-config";
import {
  validateAiCancelRequest,
  validateAiSettingsPatch,
  validateAiStreamRequest,
} from "./ipc-contracts";
import { assertIpcSender } from "./ipc-security";

type ActiveAiRequest = {
  senderId: number;
  requestId: string;
  cancelled: boolean;
  abortController: AbortController;
  abortOnDestroyed: () => void;
};

const activeRequests = new Map<string, ActiveAiRequest>();

const runProposalStreamService = createAiSchemeProposalStreaming as unknown as (
  payload: Record<string, unknown>,
  options: { env: NodeJS.ProcessEnv; onProgress: (reply: string) => void; signal: AbortSignal },
) => Promise<unknown>;

const runAgentService = createAiAgentProposal as unknown as (
  payload: Record<string, unknown>,
  options: { env: NodeJS.ProcessEnv; onEvent: (type: string, data: unknown) => void; signal: AbortSignal },
) => Promise<unknown>;

function requestKey(senderId: number, requestId: string): string {
  return `${senderId}:${requestId}`;
}

function normalizeServiceResponse(result: unknown): AiTransportResponse {
  if (!result || typeof result !== "object") {
    return { status: 500, body: { error: "AI service returned an invalid response", code: "service_failed" } };
  }
  const candidate = result as { status?: unknown; body?: unknown };
  const status = typeof candidate.status === "number" ? candidate.status : 500;
  const body = candidate.body && typeof candidate.body === "object" && !Array.isArray(candidate.body)
    ? candidate.body as Record<string, unknown>
    : { error: "AI service returned an invalid body", code: "service_failed" };
  return { status, body };
}

function beginRequest(event: IpcMainInvokeEvent, requestId: string): ActiveAiRequest {
  const key = requestKey(event.sender.id, requestId);
  if (activeRequests.has(key)) throw new Error("AI request id is already active");
  const abortController = new AbortController();
  const request: ActiveAiRequest = {
    senderId: event.sender.id,
    requestId,
    cancelled: false,
    abortController,
    abortOnDestroyed: () => {
      request.cancelled = true;
      abortController.abort();
    },
  };
  event.sender.once("destroyed", request.abortOnDestroyed);
  activeRequests.set(key, request);
  return request;
}

function emitRequestEvent(
  event: IpcMainInvokeEvent,
  request: ActiveAiRequest,
  type: string,
  data: unknown,
): void {
  if (request.cancelled || event.sender.isDestroyed()) return;
  const payload: AiRequestEvent = { requestId: request.requestId, type, data };
  event.sender.send(AI_REQUEST_EVENT, payload);
}

async function runStreamingRequest(
  event: IpcMainInvokeEvent,
  payload: unknown,
  kind: "proposal" | "agent",
): Promise<AiTransportResponse> {
  const requestData = validateAiStreamRequest(payload);
  const request = beginRequest(event, requestData.requestId);
  try {
    const result = kind === "proposal"
      ? await runProposalStreamService(requestData.payload, {
        env: process.env,
        onProgress: (reply: string) => emitRequestEvent(event, request, "progress", { reply }),
        signal: request.abortController.signal,
      })
      : await runAgentService(requestData.payload, {
        env: process.env,
        onEvent: (type: string, data: unknown) => emitRequestEvent(event, request, type, data),
        signal: request.abortController.signal,
      });
    if (request.cancelled) {
      return { status: 499, body: { error: "AI request was cancelled", code: "abort" } };
    }
    return normalizeServiceResponse(result);
  } finally {
    if (!event.sender.isDestroyed()) event.sender.off("destroyed", request.abortOnDestroyed);
    activeRequests.delete(requestKey(request.senderId, request.requestId));
  }
}

export function registerAiIpc(): void {
  syncEnvFromSettings();

  ipcMain.handle(AI_GET_USER_SETTINGS, (event): AiUserSettingsView => {
    assertIpcSender(event, AI_GET_USER_SETTINGS);
    return readSettingsView();
  });

  ipcMain.handle(AI_SET_USER_SETTINGS, (event, payload: unknown): AiUserSettingsView => {
    assertIpcSender(event, AI_SET_USER_SETTINGS);
    return writeSettings(validateAiSettingsPatch(payload));
  });

  ipcMain.handle(AI_CREATE_PROPOSAL_STREAM, (event, payload: unknown): Promise<AiTransportResponse> => {
    assertIpcSender(event, AI_CREATE_PROPOSAL_STREAM);
    return runStreamingRequest(event, payload, "proposal");
  });

  ipcMain.handle(AI_RUN_AGENT, (event, payload: unknown): Promise<AiTransportResponse> => {
    assertIpcSender(event, AI_RUN_AGENT);
    return runStreamingRequest(event, payload, "agent");
  });

  ipcMain.handle(AI_CANCEL_REQUEST, (event, payload: unknown): void => {
    assertIpcSender(event, AI_CANCEL_REQUEST);
    const { requestId } = validateAiCancelRequest(payload);
    const request = activeRequests.get(requestKey(event.sender.id, requestId));
    if (request) {
      request.cancelled = true;
      request.abortController.abort();
    }
  });
}

export function unregisterAiIpc(): void {
  ipcMain.removeHandler(AI_GET_USER_SETTINGS);
  ipcMain.removeHandler(AI_SET_USER_SETTINGS);
  ipcMain.removeHandler(AI_CREATE_PROPOSAL_STREAM);
  ipcMain.removeHandler(AI_RUN_AGENT);
  ipcMain.removeHandler(AI_CANCEL_REQUEST);
  for (const request of activeRequests.values()) {
    request.cancelled = true;
    request.abortController.abort();
  }
  activeRequests.clear();
}

export const __testing__ = {
  activeRequestCount(): number {
    return activeRequests.size;
  },
  reset(): void {
    activeRequests.clear();
  },
};
