import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AI_CANCEL_REQUEST,
  AI_CREATE_PROPOSAL_STREAM,
  AI_REQUEST_EVENT,
  AI_RUN_AGENT,
} from "../../shared/ipc-channels";

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  createProposalStream: vi.fn(),
  createAgent: vi.fn(),
  syncEnv: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      mocks.handlers.set(channel, handler);
    }),
    removeHandler: vi.fn(),
  },
}));

vi.mock("cursor-dance-api/service", () => ({
  createAiSchemeProposalStreaming: mocks.createProposalStream,
  createAiAgentProposal: mocks.createAgent,
}));

vi.mock("./ai-config", () => ({
  readSettingsView: vi.fn(() => ({ hasApiKey: false, baseUrl: "", model: "", apiMode: "" })),
  writeSettings: vi.fn(),
  syncEnvFromSettings: mocks.syncEnv,
}));

import { __testing__ as aiTesting, registerAiIpc } from "./ai-ipc";
import { __testing__ as securityTesting, registerIpcSender } from "./ipc-security";

function eventFor(id: number) {
  return {
    sender: {
      id,
      isDestroyed: () => false,
      send: vi.fn(),
      once: vi.fn(),
      off: vi.fn(),
    },
  } as unknown as Electron.IpcMainInvokeEvent;
}

describe("desktop AI IPC transport", () => {
  beforeEach(() => {
    mocks.handlers.clear();
    mocks.createProposalStream.mockReset().mockResolvedValue({ status: 200, body: { reply: "streamed" } });
    mocks.createAgent.mockReset().mockResolvedValue({ status: 200, body: { proposal: { reply: "agent" } } });
    mocks.syncEnv.mockReset();
    aiTesting.reset();
    securityTesting.reset();
    registerAiIpc();
  });

  it("syncs encrypted settings into the main-process provider", () => {
    expect(mocks.syncEnv).toHaveBeenCalledOnce();
  });

  it("routes stream events only to the requesting Workbench", async () => {
    registerIpcSender({ id: 1 }, "workbench");
    mocks.createProposalStream.mockImplementation(async (_payload, options) => {
      options.onProgress("正在生成");
      return { status: 200, body: { reply: "done" } };
    });
    const event = eventFor(1);
    const result = await mocks.handlers.get(AI_CREATE_PROPOSAL_STREAM)!(event, {
      requestId: "request-1",
      payload: { prompt: "蓝色" },
    });

    expect(event.sender.send).toHaveBeenCalledWith(AI_REQUEST_EVENT, {
      requestId: "request-1",
      type: "progress",
      data: { reply: "正在生成" },
    });
    expect(result).toEqual({ status: 200, body: { reply: "done" } });
    expect(aiTesting.activeRequestCount()).toBe(0);
  });

  it("marks an active agent request cancelled without exposing it to another sender", async () => {
    registerIpcSender({ id: 1 }, "workbench");
    registerIpcSender({ id: 2 }, "workbench");
    let finishAgent: (value: unknown) => void = () => undefined;
    let agentSignal: AbortSignal | null = null;
    mocks.createAgent.mockImplementation((_payload, options) => new Promise((resolve) => {
      agentSignal = options.signal;
      finishAgent = resolve;
    }));
    const pending = mocks.handlers.get(AI_RUN_AGENT)!(eventFor(1), {
      requestId: "agent-1",
      payload: { prompt: "蓝色" },
    }) as Promise<unknown>;
    await Promise.resolve();

    mocks.handlers.get(AI_CANCEL_REQUEST)!(eventFor(2), { requestId: "agent-1" });
    expect(aiTesting.activeRequestCount()).toBe(1);
    mocks.handlers.get(AI_CANCEL_REQUEST)!(eventFor(1), { requestId: "agent-1" });
    expect(agentSignal?.aborted).toBe(true);
    finishAgent({ status: 200, body: { proposal: { reply: "late" } } });

    await expect(pending).resolves.toEqual({
      status: 499,
      body: { error: "AI request was cancelled", code: "abort" },
    });
    expect(aiTesting.activeRequestCount()).toBe(0);
  });

  it("denies AI requests from Overlay senders", () => {
    registerIpcSender({ id: 2 }, "overlay");
    expect(() => mocks.handlers.get(AI_CREATE_PROPOSAL_STREAM)!(eventFor(2), {
      requestId: "request-overlay",
      payload: { prompt: "蓝色" },
    })).toThrow(/access denied/);
    expect(mocks.createProposalStream).not.toHaveBeenCalled();
  });
});
