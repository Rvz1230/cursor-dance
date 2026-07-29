import type { WebContents } from "electron";

/**
 * Renderer 只能停留在创建窗口时指定的入口。query/hash 可由应用内部更新，
 * 但协议、主机或路径变化都视为离开受信任页面。
 */
export function isAllowedRendererNavigation(targetUrl: string, allowedEntryUrl: string): boolean {
  try {
    const target = new URL(targetUrl);
    const allowed = new URL(allowedEntryUrl);
    return target.protocol === allowed.protocol
      && target.host === allowed.host
      && target.pathname === allowed.pathname;
  } catch {
    return false;
  }
}

/**
 * 统一收紧 BrowserWindow 的页面边界。外部链接必须通过经过协议白名单校验的
 * cursorDanceApp.openExternal 打开，renderer 不得自行导航、创建子窗口或挂载 webview。
 */
export function bindWindowSecurity(
  webContents: WebContents,
  allowedEntryUrl: string,
): () => void {
  const guardNavigation = (event: Electron.Event, targetUrl: string): void => {
    if (!isAllowedRendererNavigation(targetUrl, allowedEntryUrl)) {
      event.preventDefault();
    }
  };
  const denyWebview = (event: Electron.Event): void => {
    event.preventDefault();
  };

  webContents.on("will-navigate", guardNavigation);
  webContents.on("will-redirect", guardNavigation);
  webContents.on("will-attach-webview", denyWebview);
  webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  return () => {
    if (webContents.isDestroyed()) return;
    webContents.off("will-navigate", guardNavigation);
    webContents.off("will-redirect", guardNavigation);
    webContents.off("will-attach-webview", denyWebview);
    webContents.setWindowOpenHandler(null);
  };
}
