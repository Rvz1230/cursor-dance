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
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await electronApp.evaluate(({ BrowserWindow, screen }) => {
        const windows = BrowserWindow.getAllWindows();
        const summarize = (segment) => {
          const matching = windows.filter((win) => {
            try {
              return !win.isDestroyed()
                && !win.webContents.isDestroyed()
                && win.webContents.getURL().includes(segment);
            } catch {
              return false;
            }
          });
          return {
            count: matching.length,
            visibleCount: matching.filter((win) => {
              try { return !win.isDestroyed() && win.isVisible(); } catch { return false; }
            }).length,
          };
        };

        return {
          displayCount: screen.getAllDisplays().length,
          workbench: summarize("/renderer/workbench/index.html"),
          overlay: summarize("/renderer/overlay/index.html"),
        };
      });
    } catch (error) {
      const isTransientContextReset = String(error).includes("Execution context was destroyed");
      if (!isTransientContextReset || attempt === 2) throw error;
      await new Promise((resolveRetry) => setTimeout(resolveRetry, 50));
    }
  }
  throw new Error("Unable to read desktop window state");
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
  await expect(page.getByRole("button", { name: "主题与效果", exact: true })).toBeVisible();
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
    await expect(workbenchPage.getByText(/正在编辑：/)).toBeVisible();
    await workbenchPage.getByRole("button", { name: "专注配置", exact: true }).click();
    await expect(workbenchPage.getByRole("button", { name: "专注配置", exact: true })).toHaveAttribute("aria-pressed", "true");
    await workbenchPage.getByRole("button", { name: "命令面板", exact: true }).click();
    await expect(workbenchPage.getByRole("dialog", { name: "命令面板" })).toBeVisible();
    await workbenchPage.keyboard.press("Escape");
    await expect.poll(() => workbenchPage.evaluate(() =>
      document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute("content"),
    )).toContain("default-src 'self'");
    const aiToggle = workbenchPage.getByRole("button", { name: "AI 助手", exact: true });
    await aiToggle.click();
    await expect(workbenchPage.getByLabel("描述想要的鼠标效果")).toBeVisible();
    await aiToggle.click();
    await workbenchPage.getByRole("button", { name: "光标皮肤", exact: true }).click();
    await expect(workbenchPage.getByRole("heading", { name: "光标皮肤", exact: true })).toBeVisible();
    const cursorPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    await workbenchPage.locator('input[type="file"]:not([multiple])').setInputFiles({
      name: "arrow-default.png",
      mimeType: "image/png",
      buffer: Buffer.from(cursorPng, "base64"),
    });
    await expect(workbenchPage.getByRole("switch", { name: "启用皮肤" })).toBeVisible();
    await workbenchPage.locator('input[type="file"][multiple]').setInputFiles([
      { name: "brand-one.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="7" fill="red"/></svg>') },
      { name: "brand-two.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="blue"/></svg>') },
    ]);
    await expect(workbenchPage.getByText("待分配 2", { exact: true })).toBeVisible();
    await workbenchPage.getByRole("button", { name: "主题与效果", exact: true }).click();
    await workbenchPage.getByRole("button", { name: "光标皮肤", exact: true }).click();
    await expect(workbenchPage.getByText("待分配 2", { exact: true })).toBeVisible();
    await workbenchPage.getByRole("button", { name: "清空", exact: true }).click();
    await expect(workbenchPage.getByText("待分配 2", { exact: true })).toHaveCount(0);
    await workbenchPage.getByRole("button", { name: "全部派生", exact: true }).click();
    await expect(workbenchPage.getByText(/主皮肤 \+ 6 个独立覆盖/)).toBeVisible();
    await workbenchPage.getByRole("switch", { name: /磁场光晕/ }).click();
    await expect(workbenchPage.getByRole("slider", { name: "磁场光晕感应半径" })).toBeVisible();
    await expect(workbenchPage.getByRole("slider", { name: "磁场光晕强度" })).toBeVisible();
    await workbenchPage.getByRole("button", { name: "清除皮肤", exact: true }).click();
    await expect(workbenchPage.getByText("把图片拖到这里", { exact: true })).toBeVisible();
    await expect(workbenchPage.getByText("还没有主皮肤", { exact: true })).toBeVisible();
    await workbenchPage.getByRole("button", { name: "应用规则", exact: true }).click();
    await expect(workbenchPage.getByRole("main").getByText("应用规则", { exact: true })).toBeVisible();
    await expect(workbenchPage.getByText("全局设置 · 不属于任何主题", { exact: true })).toBeVisible();
    await expect(workbenchPage.getByRole("button", { name: /展开主题库|收起主题库/ })).toHaveCount(0);
    await workbenchPage.getByRole("button", { name: "添加应用", exact: true }).click();
    await expect(workbenchPage.getByLabel("搜索应用名称或 bundle id")).toBeVisible();
    await workbenchPage.getByRole("button", { name: "键盘动效", exact: true }).click();
    await expect(workbenchPage.getByRole("heading", { name: "键盘动效", exact: true })).toBeVisible();
    await expect(workbenchPage.getByLabel("搜索应用名称或 bundle id")).toHaveCount(0);
    const keyboardPreview = workbenchPage.getByLabel("屏幕预览：点一下再打字即可预览效果");
    await expect(keyboardPreview).toBeVisible();
    await workbenchPage.getByRole("button", { name: /^调制/ }).click();
    const comboCard = workbenchPage.locator(".keyboard-combo-card");
    await expect(comboCard).toContainText("未在连打");
    await keyboardPreview.focus();
    await expect(keyboardPreview).toBeFocused();
    await workbenchPage.keyboard.type("abcd", { delay: 15 });
    expect(await comboCard.innerText()).toContain("3 级");
    await expect(workbenchPage.locator(".keyboard-preview-glyph").filter({ hasText: "a" }).last()).toBeAttached();
    await keyboardPreview.press("Meta+k");
    await expect(workbenchPage.getByRole("dialog", { name: "命令面板" })).toHaveCount(0);
    await keyboardPreview.press("Escape");
    await expect(keyboardPreview).not.toBeFocused();
    await expect(workbenchPage.locator(".keyboard-preview-glyph")).toHaveCount(0, { timeout: 2_500 });
    await workbenchPage.getByRole("button", { name: /更多预设/ }).click();
    await workbenchPage.getByRole("radio", { name: /霓虹/ }).click();
    await expect(workbenchPage.getByRole("radio", { name: /霓虹/ })).toHaveAttribute("aria-checked", "true");
    await workbenchPage.getByRole("button", { name: /^锚点/ }).click();
    await workbenchPage.getByRole("radio", { name: /前台窗口/ }).click();
    await workbenchPage.getByRole("button", { name: /^位置/ }).click();
    await workbenchPage.getByRole("radio", { name: "打字机", exact: true }).click();
    await workbenchPage.getByRole("button", { name: /^上色/ }).click();
    await workbenchPage.getByRole("switch", { name: "渐变", exact: true }).click();
    await workbenchPage.getByRole("button", { name: /^字形/ }).click();
    await workbenchPage.getByRole("switch", { name: "拖尾", exact: true }).click();
    await workbenchPage.getByRole("button", { name: "诊断面板", exact: true }).click();
    await expect(workbenchPage.getByRole("button", { name: /开启采集|关闭采集/ })).toBeVisible();
    await workbenchPage.getByRole("button", { name: "键盘动效", exact: true }).click();
    await workbenchPage.getByRole("button", { name: /^锚点/ }).click();
    await expect(workbenchPage.getByRole("radio", { name: /前台窗口/ })).toHaveAttribute("aria-checked", "true");
    await workbenchPage.getByRole("button", { name: /^位置/ }).click();
    await expect(workbenchPage.getByRole("radio", { name: "打字机", exact: true })).toHaveAttribute("aria-checked", "true");
    await workbenchPage.getByRole("switch", { name: "启用动效", exact: true }).click();
    await expect(workbenchPage.getByText("当前主题的键盘动效已关闭", { exact: true })).toBeVisible();
    await workbenchPage.getByRole("button", { name: "继续调整", exact: true }).click();
    await expect(workbenchPage.getByText("配置仍可调整，开启后生效", { exact: true })).toBeVisible();
    await workbenchPage.getByRole("switch", { name: "启用动效", exact: true }).click();
    await workbenchPage.getByRole("button", { name: "主题与效果", exact: true }).click();
    const assetResult = await workbenchPage.evaluate(async () => {
      const bridge = window.cursorDanceStorage;
      if (!bridge) throw new Error("cursorDanceStorage bridge is unavailable");
      const current = await bridge.getConfig();
      const next = structuredClone(current);
      const theme = next.themes.find((item) => item.id === next.activeThemeId) || next.themes[0];
      const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
      theme.cursorSkin.states.default = {
        image: { kind: "dataUrl", mimeType: "image/png", dataUrl, width: 1, height: 1 },
        hotspot: { x: 0, y: 0 },
        size: { mode: "fixedBox", boxSize: 32 },
      };
      theme.actionConfigs.leftClick = {
        ...theme.actionConfigs.leftClick,
        imageEnabled: true,
        imageDataUrl: dataUrl,
      };
      const stored = await bridge.setConfig(next);
      const storedTheme = stored.themes.find((item) => item.id === stored.activeThemeId) || stored.themes[0];
      const cursorImage = storedTheme.cursorSkin.states.default.image;
      const action = storedTheme.actionConfigs.leftClick;
      const source = `cursordance-asset://asset/${encodeURIComponent(cursorImage.assetId)}`;
      const loaded = await new Promise((resolve) => {
        const image = new Image();
        const timer = window.setTimeout(() => resolve(false), 2_000);
        image.onload = () => { window.clearTimeout(timer); resolve(true); };
        image.onerror = () => { window.clearTimeout(timer); resolve(false); };
        image.src = source;
      });
      return {
        cursorKind: cursorImage.kind,
        cursorAssetId: cursorImage.assetId,
        actionAssetId: action.imageAssetId,
        actionHasInlineData: typeof action.imageDataUrl === "string" && action.imageDataUrl.startsWith("data:"),
        serializedHasInlineData: JSON.stringify(stored).includes("data:image/"),
        loaded,
      };
    });
    expect(assetResult).toMatchObject({
      cursorKind: "asset",
      actionHasInlineData: false,
      serializedHasInlineData: false,
      loaded: true,
    });
    expect(assetResult.cursorAssetId).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(assetResult.actionAssetId).toBe(assetResult.cursorAssetId);
    await expect(electronApp.evaluate(({ BrowserWindow }) => {
      const workbench = BrowserWindow.getAllWindows().find((win) =>
        win.webContents.getURL().includes("/renderer/workbench/index.html"),
      );
      return {
        navigate: workbench?.webContents.listenerCount("will-navigate") ?? 0,
        redirect: workbench?.webContents.listenerCount("will-redirect") ?? 0,
        webview: workbench?.webContents.listenerCount("will-attach-webview") ?? 0,
      };
    })).resolves.toEqual({ navigate: 1, redirect: 1, webview: 1 });
    await expect(workbenchPage.evaluate(() => window.open("https://example.com/blocked-window") === null)).resolves.toBe(true);
    await expect(workbenchPage.getByText("氛围动效", { exact: true })).toHaveCount(0);
    await expect.poll(() => workbenchPage.evaluate(async () => ({
      cursorEvents: "cursorDanceAPI" in window,
      storage: "cursorDanceStorage" in window,
      dialog: "cursorDanceDialog" in window,
      appMethods: Object.keys(window.cursorDanceApp || {}).sort(),
      updateState: await window.cursorDanceApp?.getUpdateState(),
      windowControls: "cursorDanceWindow" in window,
      aiMethods: Object.keys(window.cursorDanceAi || {}).sort(),
      platform: "electronAPI" in window,
    }))).toEqual({
      cursorEvents: false,
      storage: true,
      dialog: true,
      appMethods: [
        "checkForUpdates",
        "downloadUpdate",
        "getActiveWindow",
        "getFirstRun",
        "getUpdateState",
        "installUpdate",
        "listInstalledApplications",
        "markFirstRunComplete",
        "onActiveWindowChanged",
        "onUpdateStateChanged",
        "openExternal",
        "pickWindow",
      ],
      updateState: { status: "unsupported" },
      windowControls: true,
      aiMethods: [
        "cancelRequest",
        "createProposalStream",
        "getSettings",
        "onRequestEvent",
        "runAgent",
        "setSettings",
      ],
      platform: true,
    });
    await expect(workbenchPage.evaluate(async () => {
      if (!window.cursorDanceAi) throw new Error("cursorDanceAi bridge is unavailable");
      return window.cursorDanceAi.createProposalStream({
        requestId: "smoke-test-proposal",
        payload: {
          prompt: "smoke test proposal",
          currentConfig: {},
          actionId: "leftClick",
          taskMode: "modify_action",
        },
      });
    })).resolves.toMatchObject({
      status: 503,
      body: { code: "provider_failed" },
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
      const current = await window.cursorDanceStorage.getConfig();
      await window.cursorDanceStorage.setConfig({ ...(current || {}), enabled: false });
    });
    await expect.poll(async () => (await readWindowState(electronApp)).overlay.visibleCount).toBe(0);
    await expect(electronApp.evaluate(({ screen }) => {
      const testing = globalThis.__cursorDanceMainTesting;
      if (!testing) throw new Error("Desktop smoke routing bridge is unavailable");
      const { x, y } = screen.getPrimaryDisplay().bounds;
      testing.resetCursorIpcCount();
      testing.routeCursorEvent({
        type: "mousedown",
        x: x + 20,
        y: y + 20,
        button: 0,
        buttons: 1,
        timestamp: Date.now(),
      });
      return testing.getCursorIpcCount();
    })).resolves.toBe(0);

    await workbenchPage.evaluate(async () => {
      if (!window.cursorDanceStorage) throw new Error("cursorDanceStorage bridge is unavailable");
      const current = await window.cursorDanceStorage.getConfig();
      await window.cursorDanceStorage.setConfig({ ...(current || {}), enabled: true });
    });
    await expect.poll(async () => {
      const state = await readWindowState(electronApp);
      return state.overlay.visibleCount === state.displayCount;
    }).toBe(true);

    const overlayPage = electronApp.windows().find((page) => isWindowType(page.url(), "overlay"));
    if (!overlayPage) throw new Error("Overlay page did not open");
    await expect.poll(() => overlayPage.evaluate(() =>
      document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute("content"),
    )).toContain("default-src 'none'");
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
    const overlayOrigin = await overlayPage.evaluate(() => ({ x: window.screenX, y: window.screenY }));
    await electronApp.evaluate(() => {
      const testing = globalThis.__cursorDanceMainTesting;
      if (!testing) throw new Error("Desktop smoke routing bridge is unavailable");
      testing.routeKeyboardEvent({
        type: "keydown",
        keycode: 30,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        repeat: false,
        timestamp: Date.now(),
      });
    });
    await expect.poll(async () => {
      const overlays = electronApp.windows().filter((page) => isWindowType(page.url(), "overlay"));
      return (await Promise.all(overlays.map((page) => page.locator(".cd-key-feedback").count())))
        .reduce((sum, count) => sum + count, 0);
    }).toBeGreaterThan(0);
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
    await expect(overlayPage.locator(".cd-effect").first()).toBeAttached();

    await workbenchPage.evaluate(async () => {
      if (!window.cursorDanceStorage) throw new Error("cursorDanceStorage bridge is unavailable");
      const current = await window.cursorDanceStorage.getConfig();
      await window.cursorDanceStorage.setConfig({
        ...(current || {}),
        enabled: true,
        contextRules: [{
          id: "smoke-disable-code",
          context: "desktop",
          enabled: true,
          match: { type: "exact", value: "Code", target: "process" },
          action: { type: "disable" },
        }],
      });
    });
    await electronApp.evaluate((_electron, snapshot) => {
      const testing = globalThis.__cursorDanceMainTesting;
      if (!testing) throw new Error("Desktop smoke testing bridge is unavailable");
      testing.publishActiveWindowSnapshot(snapshot);
    }, activeCodeSnapshot);

    await expect.poll(async () => (await readWindowState(electronApp)).overlay.visibleCount).toBe(0);
    await expect(overlayPage.locator(".cd-effect")).toHaveCount(0);
    await sendClick();
    await overlayPage.waitForTimeout(150);
    await expect(overlayPage.locator(".cd-effect")).toHaveCount(0);

    await workbenchPage.evaluate(async () => {
      if (!window.cursorDanceStorage) throw new Error("cursorDanceStorage bridge is unavailable");
      const current = await window.cursorDanceStorage.getConfig();
      await window.cursorDanceStorage.setConfig({ ...(current || {}), contextRules: [] });
    });
    await expect.poll(async () => {
      const state = await readWindowState(electronApp);
      return state.overlay.visibleCount === state.displayCount;
    }).toBe(true);
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
