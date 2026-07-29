import type { BrowserWindow } from "electron";

type OverlaySpaceWindow = Pick<
  BrowserWindow,
  "setAlwaysOnTop" | "setVisibleOnAllWorkspaces"
>;

export function getOverlayWindowType(
  platform: NodeJS.Platform = process.platform,
): "panel" | undefined {
  // A normal NSWindow can remain bound to the main display's regular Space
  // when multiple displays are simultaneously fullscreen. NSPanel accepts
  // canJoinAllSpaces/fullScreenAuxiliary on every display.
  return platform === "darwin" ? "panel" : undefined;
}

/**
 * Keep an overlay above regular windows and attached to native fullscreen Spaces.
 *
 * Do not call setHiddenInMissionControl(true) for overlays. It mutates the same
 * native collection behavior used by canJoinAllSpaces/fullScreenAuxiliary and
 * adds no functional value to an already non-focusable panel. Keeping one
 * owner for the Space policy avoids order-dependent native state.
 */
export function applyOverlaySpacePolicy(
  win: OverlaySpaceWindow,
  platform: NodeJS.Platform = process.platform,
): void {
  win.setAlwaysOnTop(true, "screen-saver");
  if (platform === "darwin") {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } else if (platform === "linux") {
    win.setVisibleOnAllWorkspaces(true);
  }
}
