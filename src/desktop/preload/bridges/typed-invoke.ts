import { ipcRenderer } from "electron";
import type {
  DesktopIpcInvokeChannel,
  DesktopIpcRequest,
  DesktopIpcResponse,
} from "../../../shared/desktop-ipc-contracts";

export function invokeDesktop<C extends DesktopIpcInvokeChannel>(
  channel: C,
  ...args: DesktopIpcRequest<C> extends void ? [] : [payload: DesktopIpcRequest<C>]
): Promise<DesktopIpcResponse<C>> {
  return ipcRenderer.invoke(channel, ...args) as Promise<DesktopIpcResponse<C>>;
}
