import { expect, test, _electron as electron } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const PROJECT_ROOT = resolve(import.meta.dirname, "../..");

function isWindowType(url, type) {
  return url.includes(`/renderer/${type}/index.html`);
}

async function readWindowState(electronApp) {
  return electronApp.evaluate(({ BrowserWindow, screen }) => {
    const windows = BrowserWindow.getAllWindows().filter((win) => !win.isDestroyed());
    const summarize = (segment) => {
      const matching = windows.filter((win) => win.webContents.getURL().includes(segment));
      return {
        count: matching.length,
        visibleCount: matching.filter((win) => win.isVisible()).length,
      };
    };

    return {
      displayCount: screen.getAllDisplays().length,
      workbench: summarize("/renderer/workbench/index.html"),
      overlay: summarize("/renderer/overlay/index.html"),
    };
  });
}

async function getWorkbenchPage(electronApp) {
  await expect.poll(() => electronApp.windows().filter((page) => isWindowType(page.url(), "workbench")).length).toBe(1);
  const page = electronApp.windows().find((candidate) => isWindowType(candidate.url(), "workbench"));
  if (!page) throw new Error("Workbench page did not open");
  return page;
}

async function waitForWorkbenchReady(page) {
  const isFirstRun = await page.evaluate(async () => {
    if (!window.cursorDanceApp) throw new Error("cursorDanceApp bridge is unavailable");
    return window.cursorDanceApp.getFirstRun();
  });
  if (isFirstRun) {
    const welcomeDialog = page.getByRole("dialog", { name: "欢迎使用 CursorDance" });
    await expect(welcomeDialog).toBeVisible();
    await welcomeDialog.getByRole("button", { name: "打开工作台" }).click();
    await expect.poll(() => page.evaluate(() => window.cursorDanceApp?.getFirstRun())).toBe(false);
  }
  await expect(page.getByRole("button", { name: "保存" })).toBeVisible();
}

async function launchSecondInstance(env, executablePath) {
  const child = spawn(executablePath, [PROJECT_ROOT, "--disable-gpu", "--no-sandbox"], {
    cwd: PROJECT_ROOT,
    env,
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const result = await new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error("second Electron instance did not exit")), 15_000);
    child.once("error", (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timeoutId);
      resolve({ code, signal });
    });
  });
  expect(result, stderr).toMatchObject({ code: 0, signal: null });
}

test("desktop lifecycle keeps one Workbench and one overlay per display", async () => {
  const userDataPath = await mkdtemp(join(tmpdir(), "cursor-dance-smoke-"));
  const env = {
    ...process.env,
    CURSORDANCE_DESKTOP_SMOKE: "1",
    CURSORDANCE_DESKTOP_SMOKE_USER_DATA: userDataPath,
    ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
  };

  let electronApp;

  try {
    electronApp = await electron.launch({
      args: [PROJECT_ROOT, "--disable-gpu", "--no-sandbox"],
      cwd: PROJECT_ROOT,
      env,
    });

    let workbenchPage = await getWorkbenchPage(electronApp);
    await expect(workbenchPage).toHaveTitle("CursorDance 工作台");
    await waitForWorkbenchReady(workbenchPage);
    await expect(workbenchPage.getByText("氛围动效", { exact: true })).toHaveCount(0);
    await expect.poll(() => workbenchPage.evaluate(() => ({
      cursorEvents: "cursorDanceAPI" in window,
      storage: "cursorDanceStorage" in window,
      dialog: "cursorDanceDialog" in window,
      app: "cursorDanceApp" in window,
      windowControls: "cursorDanceWindow" in window,
      ai: "cursorDanceAi" in window,
      platform: "electronAPI" in window,
    }))).toEqual({
      cursorEvents: false,
      storage: true,
      dialog: true,
      app: true,
      windowControls: true,
      ai: true,
      platform: true,
    });

    await expect.poll(() => readWindowState(electronApp)).toMatchObject({
      workbench: { count: 1, visibleCount: 1 },
    });
    await expect.poll(async () => {
      const state = await readWindowState(electronApp);
      return state.overlay.count === state.displayCount;
    }).toBe(true);

    await electronApp.evaluate(({ BrowserWindow }) => {
      const workbench = BrowserWindow.getAllWindows().find((win) =>
        win.webContents.getURL().includes("/renderer/workbench/index.html"),
      );
      workbench?.close();
    });
    await expect.poll(async () => (await readWindowState(electronApp)).workbench.count).toBe(0);

    await launchSecondInstance(env, electronApp.process().spawnfile);
    workbenchPage = await getWorkbenchPage(electronApp);
    await waitForWorkbenchReady(workbenchPage);
    await expect.poll(async () => (await readWindowState(electronApp)).workbench.count).toBe(1);

    await workbenchPage.evaluate(async () => {
      if (!window.cursorDanceStorage) throw new Error("cursorDanceStorage bridge is unavailable");
      await window.cursorDanceStorage.setConfig({ enabled: false });
    });
    await expect.poll(async () => (await readWindowState(electronApp)).overlay.visibleCount).toBe(0);

    await workbenchPage.evaluate(async () => {
      if (!window.cursorDanceStorage) throw new Error("cursorDanceStorage bridge is unavailable");
      await window.cursorDanceStorage.setConfig({ enabled: true });
    });
    await expect.poll(async () => {
      const state = await readWindowState(electronApp);
      return state.overlay.visibleCount === state.displayCount;
    }).toBe(true);

    const overlayPage = electronApp.windows().find((page) => isWindowType(page.url(), "overlay"));
    if (!overlayPage) throw new Error("Overlay page did not open");
    await expect.poll(() => overlayPage.evaluate(() => ({
      cursorEvents: "cursorDanceAPI" in window,
      storageMethods: Object.keys(window.cursorDanceStorage || {}).sort(),
      appMethods: Object.keys(window.cursorDanceApp || {}).sort(),
      dialog: "cursorDanceDialog" in window,
      windowControls: "cursorDanceWindow" in window,
      ai: "cursorDanceAi" in window,
      platform: "electronAPI" in window,
    }))).toEqual({
      cursorEvents: true,
      storageMethods: ["getConfig", "onChange", "onLivePreviewChange"],
      appMethods: ["getActiveWindow", "onActiveWindowChanged"],
      dialog: false,
      windowControls: false,
      ai: false,
      platform: false,
    });
    const activeCodeSnapshot = {
      authorized: true,
      owner: { name: "Code", bundleId: "com.microsoft.VSCode" },
      processName: "Code",
      title: "README — CursorDance smoke",
    };

    await workbenchPage.evaluate(async () => {
      if (!window.cursorDanceStorage) throw new Error("cursorDanceStorage bridge is unavailable");
      const current = await window.cursorDanceStorage.getConfig();
      await window.cursorDanceStorage.setConfig({
        ...(current || {}),
        enabled: true,
        appRules: [{
          id: "smoke-disable-code",
          pattern: { type: "exact", value: "Code", target: "process" },
          action: "disable",
          enabled: true,
        }],
      });
    });
    await electronApp.evaluate(({ BrowserWindow }, snapshot) => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send("cursordance:app-active-window-changed", snapshot);
      }
    }, activeCodeSnapshot);

    const overlayOrigin = await overlayPage.evaluate(() => ({ x: window.screenX, y: window.screenY }));
    const sendClick = () => electronApp.evaluate((_electron, point) => {
      const testing = globalThis.__cursorDanceMainTesting;
      if (!testing) throw new Error("Desktop smoke routing bridge is unavailable");
      const timestamp = Date.now();
      testing.routeCursorEvent({
        type: "mousedown", x: point.x, y: point.y, button: 0, buttons: 1, timestamp,
      });
      testing.routeCursorEvent({
        type: "mouseup", x: point.x, y: point.y, button: 0, buttons: 0, timestamp: timestamp + 1,
      });
    }, {
      x: overlayOrigin.x + 120,
      y: overlayOrigin.y + 120,
    });

    await sendClick();
    await overlayPage.waitForTimeout(150);
    await expect(overlayPage.locator(".cd-effect")).toHaveCount(0);

    await workbenchPage.evaluate(async () => {
      if (!window.cursorDanceStorage) throw new Error("cursorDanceStorage bridge is unavailable");
      const current = await window.cursorDanceStorage.getConfig();
      await window.cursorDanceStorage.setConfig({ ...(current || {}), appRules: [] });
    });
    await sendClick();
    await expect(overlayPage.locator(".cd-effect").first()).toBeAttached();
    for (const otherOverlay of electronApp.windows().filter(
      (page) => isWindowType(page.url(), "overlay") && page !== overlayPage,
    )) {
      await expect(otherOverlay.locator(".cd-effect")).toHaveCount(0);
    }
  } finally {
    await electronApp?.close();
    await rm(userDataPath, { recursive: true, force: true });
  }
});
