import { describe, expect, it, vi } from "vitest";
import { bindWindowSecurity, isAllowedRendererNavigation } from "./window-security";

type Listener = (...args: unknown[]) => void;

function makeWebContents() {
  const listeners = new Map<string, Listener>();
  const webContents = {
    on: vi.fn((event: string, listener: Listener) => {
      listeners.set(event, listener);
      return webContents;
    }),
    off: vi.fn((event: string, listener: Listener) => {
      if (listeners.get(event) === listener) listeners.delete(event);
      return webContents;
    }),
    setWindowOpenHandler: vi.fn(),
    isDestroyed: vi.fn(() => false),
  };
  return { webContents, listeners };
}

describe("isAllowedRendererNavigation", () => {
  const entryUrl = "file:///Applications/CursorDance/resources/app.asar/out/renderer/workbench/index.html";

  it("allows the exact renderer entry with query or hash changes", () => {
    expect(isAllowedRendererNavigation(entryUrl, entryUrl)).toBe(true);
    expect(isAllowedRendererNavigation(`${entryUrl}?panel=ai#latest`, entryUrl)).toBe(true);
  });

  it("rejects another protocol, host or renderer path", () => {
    expect(isAllowedRendererNavigation("https://example.com/index.html", entryUrl)).toBe(false);
    expect(isAllowedRendererNavigation(
      "file:///Applications/CursorDance/resources/app.asar/out/renderer/overlay/index.html",
      entryUrl,
    )).toBe(false);
    expect(isAllowedRendererNavigation("not a url", entryUrl)).toBe(false);
  });

  it("keeps development navigation on the exact dev-server entry", () => {
    const devEntry = "http://localhost:5173/workbench/index.html";
    expect(isAllowedRendererNavigation("http://localhost:5173/workbench/index.html#theme", devEntry)).toBe(true);
    expect(isAllowedRendererNavigation("http://127.0.0.1:5173/workbench/index.html", devEntry)).toBe(false);
    expect(isAllowedRendererNavigation("http://localhost:5173/overlay/index.html", devEntry)).toBe(false);
  });
});

describe("bindWindowSecurity", () => {
  it("blocks untrusted navigation and redirects while allowing the entry URL", () => {
    const { webContents, listeners } = makeWebContents();
    const entryUrl = "file:///app/renderer/workbench/index.html";
    bindWindowSecurity(webContents as unknown as Electron.WebContents, entryUrl);

    const navigate = listeners.get("will-navigate");
    const redirect = listeners.get("will-redirect");
    const allowedEvent = { preventDefault: vi.fn() };
    const blockedEvent = { preventDefault: vi.fn() };
    navigate?.(allowedEvent, `${entryUrl}#settings`);
    redirect?.(blockedEvent, "https://example.com");

    expect(allowedEvent.preventDefault).not.toHaveBeenCalled();
    expect(blockedEvent.preventDefault).toHaveBeenCalledOnce();
  });

  it("denies Electron child windows and webview attachment", () => {
    const { webContents, listeners } = makeWebContents();
    bindWindowSecurity(
      webContents as unknown as Electron.WebContents,
      "file:///app/renderer/workbench/index.html",
    );

    const openHandler = webContents.setWindowOpenHandler.mock.calls[0]?.[0] as (() => { action: string });
    expect(openHandler()).toEqual({ action: "deny" });

    const attachEvent = { preventDefault: vi.fn() };
    listeners.get("will-attach-webview")?.(attachEvent);
    expect(attachEvent.preventDefault).toHaveBeenCalledOnce();
  });

  it("removes listeners and the open handler during cleanup", () => {
    const { webContents } = makeWebContents();
    const unbind = bindWindowSecurity(
      webContents as unknown as Electron.WebContents,
      "file:///app/renderer/overlay/index.html",
    );

    unbind();

    expect(webContents.off).toHaveBeenCalledTimes(3);
    expect(webContents.setWindowOpenHandler).toHaveBeenLastCalledWith(null);
  });

  it("does not touch an already destroyed webContents during cleanup", () => {
    const { webContents } = makeWebContents();
    const unbind = bindWindowSecurity(
      webContents as unknown as Electron.WebContents,
      "file:///app/renderer/overlay/index.html",
    );
    webContents.isDestroyed.mockReturnValue(true);

    unbind();

    expect(webContents.off).not.toHaveBeenCalled();
    expect(webContents.setWindowOpenHandler).toHaveBeenCalledTimes(1);
  });
});
