import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _electron as electron } from "@playwright/test";
import { getPackagedDesktopPaths } from "./packaged-desktop-paths.mjs";

const paths = await getPackagedDesktopPaths();
const userDataPath = await mkdtemp(join(tmpdir(), "cursor-dance-package-smoke-"));
let electronApp;

function isWorkbench(page) {
  return page.url().includes("/renderer/workbench/index.html");
}

async function waitFor(predicate, description, timeoutMs = 15_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${description}`);
}

try {
  electronApp = await electron.launch({
    executablePath: paths.executablePath,
    env: {
      ...process.env,
      CURSORDANCE_DESKTOP_SMOKE: "1",
      CURSORDANCE_DESKTOP_SMOKE_USER_DATA: userDataPath,
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
    },
  });

  const workbench = await waitFor(
    () => electronApp.windows().find(isWorkbench),
    "the packaged Workbench window",
  );
  await workbench.waitForLoadState("domcontentloaded");
  const title = await workbench.title();
  if (title !== "CursorDance 工作台") throw new Error(`Unexpected packaged Workbench title: ${title}`);

  const isFirstRun = await workbench.evaluate(() => window.cursorDanceApp?.getFirstRun());
  if (isFirstRun) {
    const welcomeButton = workbench.getByRole("dialog", { name: "欢迎使用 CursorDance" })
      .getByRole("button", { name: "打开工作台" });
    await welcomeButton.waitFor({ state: "visible", timeout: 10_000 });
    await welcomeButton.click();
  }
  await workbench.getByRole("button", { name: "保存" }).waitFor({ state: "visible", timeout: 10_000 });

  const rendererState = await workbench.evaluate(async () => ({
    hasAppBridge: Boolean(window.cursorDanceApp),
    hasStorageBridge: Boolean(window.cursorDanceStorage),
    configVersion: (await window.cursorDanceStorage?.getConfig())?.schemaVersion,
    updateState: await window.cursorDanceApp?.getUpdateState(),
  }));
  if (
    !rendererState.hasAppBridge
    || !rendererState.hasStorageBridge
    || rendererState.configVersion !== 4
    || rendererState.updateState?.status !== "unsupported"
  ) {
    throw new Error(`Packaged renderer bridge/config check failed: ${JSON.stringify(rendererState)}`);
  }

  const mainState = await waitFor(async () => {
    const state = await electronApp.evaluate(({ app, BrowserWindow, screen }) => {
      const urls = BrowserWindow.getAllWindows().map((window) => window.webContents.getURL());
      return {
        isPackaged: app.isPackaged,
        displayCount: screen.getAllDisplays().length,
        overlayCount: urls.filter((url) => url.includes("/renderer/overlay/index.html")).length,
        workbenchCount: urls.filter((url) => url.includes("/renderer/workbench/index.html")).length,
      };
    });
    return state.isPackaged && state.workbenchCount === 1 && state.overlayCount === state.displayCount
      ? state
      : null;
  }, "the packaged Workbench and display overlays");

  console.info(`[desktop-package] startup smoke passed: ${JSON.stringify(mainState)}`);
} finally {
  await electronApp?.close();
  await rm(userDataPath, { recursive: true, force: true });
}
