import { mkdtemp, mkdir, readdir, realpath, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { _electron as electron } from "@playwright/test";
import { getPackagedDesktopPaths } from "./packaged-desktop-paths.mjs";

const paths = await getPackagedDesktopPaths();
const smokeRoot = await mkdtemp(join(tmpdir(), "cursor-dance-package-smoke-"));
const userDataPath = join(smokeRoot, "user-data");
let electronApp;
let mountedDmgPath = null;
let executablePath = paths.executablePath;

function run(command, args, description) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${description} failed: ${(result.stderr || result.stdout).trim()}`);
  }
}

async function prepareMacDmgApplication() {
  const names = await readdir(paths.outputDirectory);
  const dmgNames = names.filter((name) => name.toLowerCase().endsWith(".dmg"));
  if (dmgNames.length !== 1) throw new Error(`Expected one DMG for smoke; found ${dmgNames.length}`);

  const mountPoint = join(smokeRoot, "mounted-dmg");
  const installedRoot = join(smokeRoot, "installed");
  await mkdir(mountPoint);
  await mkdir(installedRoot);
  mountedDmgPath = mountPoint;
  run(
    "hdiutil",
    ["attach", "-readonly", "-nobrowse", "-mountpoint", mountPoint, join(paths.outputDirectory, dmgNames[0])],
    "mount packaged DMG",
  );

  const appNames = (await readdir(mountPoint)).filter((name) => name.endsWith(".app"));
  if (appNames.length !== 1) throw new Error(`Expected one app in DMG; found ${appNames.length}`);
  const installedApp = join(installedRoot, appNames[0]);
  run("ditto", [join(mountPoint, appNames[0]), installedApp], "copy app from DMG");
  return join(installedApp, "Contents", "MacOS", basename(paths.executablePath));
}

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
  if (paths.platform === "darwin" && process.env.CURSORDANCE_PACKAGE_DMG === "1") {
    executablePath = await prepareMacDmgApplication();
  }
  electronApp = await electron.launch({
    executablePath,
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
  await workbench.getByRole("navigation", { name: "工作区" }).waitFor({ state: "visible", timeout: 10_000 });

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

  const nativeModuleLoaded = await electronApp.evaluate(async () => {
    const testing = globalThis.__cursorDanceMainTesting;
    return testing ? testing.loadNativeEventsModule() : false;
  });
  if (!nativeModuleLoaded) {
    throw new Error("Packaged uiohook native module did not load from app.asar.unpacked");
  }

  const runningExecutable = await electronApp.evaluate(() => process.execPath);
  if (await realpath(runningExecutable) !== await realpath(executablePath)) {
    throw new Error(`Smoke launched ${runningExecutable}, expected copied DMG app at ${executablePath}`);
  }

  const mainState = await waitFor(async () => {
    const state = await electronApp.evaluate(({ app, BrowserWindow, screen }) => {
      const urls = BrowserWindow.getAllWindows().map((window) => window.webContents.getURL());
      return {
        isPackaged: app.isPackaged,
        displayCount: screen.getAllDisplays().length,
        overlayCount: urls.filter((url) => url.includes("/renderer/overlay/index.html")).length,
        workbenchCount: urls.filter((url) => url.includes("/renderer/workbench/index.html")).length,
        execPath: process.execPath,
      };
    });
    return state.isPackaged
      && state.workbenchCount === 1
      && state.overlayCount === state.displayCount
      ? state
      : null;
  }, "the packaged Workbench and display overlays");

  console.info(`[desktop-package] startup smoke passed: ${JSON.stringify(mainState)}`);
} finally {
  await electronApp?.close();
  if (mountedDmgPath) {
    const detach = spawnSync("hdiutil", ["detach", mountedDmgPath], { encoding: "utf8" });
    if (detach.status !== 0) {
      console.warn(`[desktop-package] failed to detach smoke DMG: ${detach.stderr.trim()}`);
    }
  }
  await rm(smokeRoot, { recursive: true, force: true });
}
