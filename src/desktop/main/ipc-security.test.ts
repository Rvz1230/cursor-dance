import { beforeEach, describe, expect, it } from "vitest";
import {
  APP_GET_ACTIVE_WINDOW,
  CURSOR_VISIBILITY_SET_HIDDEN,
  STORE_GET,
  STORE_SET,
} from "../../shared/ipc-channels";
import {
  IPC_SENDER_POLICY,
  __testing__,
  assertIpcSender,
  getIpcSenderKind,
  registerIpcSender,
} from "./ipc-security";

function eventFor(id: number) {
  return { sender: { id } } as Electron.IpcMainInvokeEvent;
}

describe("IPC sender policy", () => {
  beforeEach(() => __testing__.reset());

  it("registers and removes trusted renderer identities", () => {
    const sender = { id: 10 };
    const unregister = registerIpcSender(sender, "workbench");
    expect(getIpcSenderKind(sender)).toBe("workbench");
    unregister();
    expect(getIpcSenderKind(sender)).toBeNull();
  });

  it("does not let stale cleanup remove a replacement registration", () => {
    const sender = { id: 10 };
    const unregisterOld = registerIpcSender(sender, "workbench");
    registerIpcSender(sender, "workbench");
    unregisterOld();
    expect(getIpcSenderKind(sender)).toBe("workbench");
  });

  it("allows shared read channels from both window kinds", () => {
    registerIpcSender({ id: 1 }, "workbench");
    registerIpcSender({ id: 2 }, "overlay");
    expect(assertIpcSender(eventFor(1), STORE_GET)).toBe("workbench");
    expect(assertIpcSender(eventFor(2), APP_GET_ACTIVE_WINDOW)).toBe("overlay");
  });

  it("rejects workbench-only writes from overlays", () => {
    registerIpcSender({ id: 2 }, "overlay");
    expect(() => assertIpcSender(eventFor(2), STORE_SET)).toThrow(/access denied/);
  });

  it("rejects overlay-only cursor control from Workbench", () => {
    registerIpcSender({ id: 1 }, "workbench");
    expect(() => assertIpcSender(eventFor(1), CURSOR_VISIBILITY_SET_HIDDEN)).toThrow(/access denied/);
  });

  it("denies unknown senders and channels by default", () => {
    registerIpcSender({ id: 1 }, "workbench");
    expect(() => assertIpcSender(eventFor(99), STORE_GET)).toThrow(/unknown renderer/);
    expect(() => assertIpcSender(eventFor(1), "cursordance:unknown")).toThrow(/access denied/);
  });

  it("keeps the policy explicit for shared, Workbench and Overlay capabilities", () => {
    expect(IPC_SENDER_POLICY[STORE_GET]).toEqual(["workbench", "overlay"]);
    expect(IPC_SENDER_POLICY[STORE_SET]).toEqual(["workbench"]);
    expect(IPC_SENDER_POLICY[CURSOR_VISIBILITY_SET_HIDDEN]).toEqual(["overlay"]);
  });
});
