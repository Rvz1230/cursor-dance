import type { IpcMainInvokeEvent } from "electron";
import {
  AI_CANCEL_REQUEST,
  AI_CREATE_PROPOSAL_STREAM,
  AI_GET_USER_SETTINGS,
  AI_RUN_AGENT,
  AI_SET_USER_SETTINGS,
  APP_GET_ACTIVE_WINDOW,
  APP_GET_FIRST_RUN,
  APP_MARK_FIRST_RUN_COMPLETE,
  APP_OPEN_EXTERNAL,
  APP_UPDATE_CHECK,
  APP_UPDATE_DOWNLOAD,
  APP_UPDATE_GET_STATE,
  APP_UPDATE_INSTALL,
  CURSOR_VISIBILITY_SET_HIDDEN,
  DIALOG_OPEN_THEME_FILE,
  DIALOG_SAVE_THEME_FILE,
  STORE_CLEAR_LIVE_PREVIEW,
  STORE_GET,
  STORE_GET_LIVE_PREVIEW,
  STORE_SET,
  STORE_SET_LIVE_PREVIEW,
  WINDOW_CLOSE,
  WINDOW_GET_STATE,
  WINDOW_MINIMIZE,
  WINDOW_TOGGLE_MAXIMIZE,
} from "../../shared/ipc-channels";

export type DesktopWindowKind = "workbench" | "overlay";

type SenderIdentity = Pick<IpcMainInvokeEvent["sender"], "id">;

type SenderRegistration = {
  kind: DesktopWindowKind;
  token: symbol;
};

const senderKinds = new Map<number, SenderRegistration>();

export const IPC_SENDER_POLICY: Readonly<Record<string, readonly DesktopWindowKind[]>> = {
  [STORE_GET]: ["workbench", "overlay"],
  [STORE_SET]: ["workbench"],
  [STORE_GET_LIVE_PREVIEW]: ["workbench"],
  [STORE_SET_LIVE_PREVIEW]: ["workbench"],
  [STORE_CLEAR_LIVE_PREVIEW]: ["workbench"],
  [DIALOG_SAVE_THEME_FILE]: ["workbench"],
  [DIALOG_OPEN_THEME_FILE]: ["workbench"],
  [APP_GET_ACTIVE_WINDOW]: ["workbench", "overlay"],
  [APP_GET_FIRST_RUN]: ["workbench"],
  [APP_MARK_FIRST_RUN_COMPLETE]: ["workbench"],
  [APP_OPEN_EXTERNAL]: ["workbench"],
  [APP_UPDATE_GET_STATE]: ["workbench"],
  [APP_UPDATE_CHECK]: ["workbench"],
  [APP_UPDATE_DOWNLOAD]: ["workbench"],
  [APP_UPDATE_INSTALL]: ["workbench"],
  [WINDOW_MINIMIZE]: ["workbench"],
  [WINDOW_TOGGLE_MAXIMIZE]: ["workbench"],
  [WINDOW_CLOSE]: ["workbench"],
  [WINDOW_GET_STATE]: ["workbench"],
  [AI_GET_USER_SETTINGS]: ["workbench"],
  [AI_SET_USER_SETTINGS]: ["workbench"],
  [AI_CREATE_PROPOSAL_STREAM]: ["workbench"],
  [AI_RUN_AGENT]: ["workbench"],
  [AI_CANCEL_REQUEST]: ["workbench"],
  [CURSOR_VISIBILITY_SET_HIDDEN]: ["overlay"],
};

export function registerIpcSender(sender: SenderIdentity, kind: DesktopWindowKind): () => void {
  const registration = { kind, token: Symbol(kind) };
  senderKinds.set(sender.id, registration);
  return () => {
    if (senderKinds.get(sender.id)?.token === registration.token) senderKinds.delete(sender.id);
  };
}

export function getIpcSenderKind(sender: SenderIdentity): DesktopWindowKind | null {
  return senderKinds.get(sender.id)?.kind ?? null;
}

export function assertIpcSender(
  event: Pick<IpcMainInvokeEvent, "sender">,
  channel: string,
): DesktopWindowKind {
  const kind = getIpcSenderKind(event.sender);
  const allowedKinds = IPC_SENDER_POLICY[channel];
  if (!kind || !allowedKinds?.includes(kind)) {
    throw new Error(`IPC access denied: ${channel} from ${kind ?? "unknown"} renderer`);
  }
  return kind;
}

export const __testing__ = {
  reset(): void {
    senderKinds.clear();
  },
};
