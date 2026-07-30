import { gzipSync } from "node:zlib";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { _electron as electron } from "@playwright/test";
import { createServer as createViteServer } from "vite";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const SOURCE_EXTENSIONS = new Set([".css", ".html", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const IMAGE_FIXTURE_DATA_BYTES = 256 * 1024;
const staticOnly = process.argv.includes("--static-only");

const [nodeMajor, nodeMinor] = process.versions.node.split(".").map(Number);
if (nodeMajor < 22 || (nodeMajor === 22 && nodeMinor < 12)) {
  throw new Error(`Desktop baseline requires Node.js >=22.12.0; current version is ${process.version}`);
}

async function listSourceFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await listSourceFiles(path));
    else if (SOURCE_EXTENSIONS.has(extname(entry.name))) files.push(path);
  }
  return files;
}

function countEffectiveLines(source) {
  let blockComment = false;
  let count = 0;

  for (const originalLine of source.split(/\r?\n/)) {
    let line = originalLine.trim();
    if (!line) continue;

    while (line) {
      if (blockComment) {
        const end = line.indexOf("*/");
        if (end === -1) {
          line = "";
          break;
        }
        blockComment = false;
        line = line.slice(end + 2).trim();
        continue;
      }

      if (line.startsWith("//") || line.startsWith("<!--")) {
        line = "";
        break;
      }

      const start = line.indexOf("/*");
      if (start === -1) break;
      const end = line.indexOf("*/", start + 2);
      if (end === -1) {
        blockComment = true;
        line = line.slice(0, start).trim();
        break;
      }
      line = `${line.slice(0, start)} ${line.slice(end + 2)}`.trim();
    }

    if (line) count += 1;
  }

  return count;
}

async function measureCodeArea(label, roots) {
  const files = (await Promise.all(roots.map((root) => listSourceFiles(resolve(PROJECT_ROOT, root))))).flat();
  let productionLines = 0;
  let testLines = 0;
  let productionFiles = 0;
  let testFiles = 0;

  for (const file of files) {
    const lines = countEffectiveLines(await readFile(file, "utf8"));
    const isTest = /(?:^|\/)[^/]+\.(?:test|spec)\.[^.]+$/.test(file);
    if (isTest) {
      testFiles += 1;
      testLines += lines;
    } else {
      productionFiles += 1;
      productionLines += lines;
    }
  }

  return {
    label,
    roots,
    production: { files: productionFiles, effectiveLines: productionLines },
    tests: { files: testFiles, effectiveLines: testLines },
    total: { files: files.length, effectiveLines: productionLines + testLines },
  };
}

async function measureReferencedBundle(entryName) {
  const htmlPath = resolve(PROJECT_ROOT, `out/renderer/${entryName}/index.html`);
  const html = await readFile(htmlPath, "utf8");
  const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((path) => path.includes("/assets/"));
  const assets = [...new Set(references.map((path) => resolve(dirname(htmlPath), path)))];

  let rawBytes = 0;
  let gzipBytes = 0;
  const files = [];
  for (const asset of assets) {
    const contents = await readFile(asset);
    rawBytes += contents.byteLength;
    gzipBytes += gzipSync(contents).byteLength;
    files.push(relative(resolve(PROJECT_ROOT, "out/renderer"), asset));
  }

  return { files, rawBytes, gzipBytes };
}

async function measureConfigPayloads() {
  const vite = await createViteServer({
    root: PROJECT_ROOT,
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  let config;
  try {
    const module = await vite.ssrLoadModule("/src/shared/config/default-config.ts");
    config = module.defaultConfig;
  } finally {
    await vite.close();
  }
  if (!config || config.schemaVersion !== 4 || !Array.isArray(config.themes)) {
    throw new Error("Canonical schema v4 default config export was not found");
  }

  const withImage = structuredClone(config);
  const pack = withImage.themes[0];
  const imageDataUrl = `data:image/png;base64,${"A".repeat(IMAGE_FIXTURE_DATA_BYTES)}`;
  if (pack) {
    pack.cursorSkin ??= {};
    pack.cursorSkin.states ??= {};
    pack.cursorSkin.states.default = {
      image: { kind: "dataUrl", mimeType: "image/png", dataUrl: imageDataUrl },
      hotspot: { x: 0, y: 0 },
      size: { boxSize: 32, mode: "contain" },
    };
  } else {
    withImage.baselineImageDataUrl = imageDataUrl;
  }

  const bytes = (value) => Buffer.byteLength(JSON.stringify(value));
  return {
    defaultConfigBytes: bytes(config),
    imageFixtureDataBytes: IMAGE_FIXTURE_DATA_BYTES,
    configWithImageBytes: bytes(withImage),
  };
}

async function waitFor(getValue, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await getValue();
    if (value) return value;
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  throw new Error(`Timed out after ${timeoutMs}ms`);
}

async function measureRuntime() {
  const userDataPath = await mkdtemp(join(tmpdir(), "cursor-dance-baseline-"));
  const env = {
    ...process.env,
    CURSORDANCE_DESKTOP_SMOKE: "1",
    CURSORDANCE_DESKTOP_SMOKE_USER_DATA: userDataPath,
    ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
  };
  const launchStartedAt = performance.now();
  let electronApp;

  try {
    electronApp = await electron.launch({
      args: [PROJECT_ROOT, "--disable-gpu", "--no-sandbox"],
      cwd: PROJECT_ROOT,
      env,
    });

    const workbenchPage = await waitFor(() => electronApp.windows().find((page) =>
      page.url().includes("/renderer/workbench/index.html"),
    ));
    await workbenchPage.waitForLoadState("domcontentloaded");

    const isFirstRun = await workbenchPage.evaluate(() => window.cursorDanceApp?.getFirstRun());
    if (isFirstRun) {
      const welcomeDialog = workbenchPage.getByRole("dialog", { name: "欢迎使用 CursorDance" });
      await welcomeDialog.waitFor({ state: "visible" });
      await welcomeDialog.getByRole("button", { name: "打开工作台" }).click();
    }
    await workbenchPage.getByRole("button", { name: "保存" }).waitFor({ state: "visible" });
    const coldStartToWorkbenchReadyMs = performance.now() - launchStartedAt;

    const windowCounts = await waitFor(async () => {
      const state = await electronApp.evaluate(({ BrowserWindow, screen }) => {
        const windows = BrowserWindow.getAllWindows().filter((win) => !win.isDestroyed());
        const overlays = windows.filter((win) => win.webContents.getURL().includes("/renderer/overlay/index.html"));
        return {
          displayCount: screen.getAllDisplays().length,
          overlayCount: overlays.length,
          workbenchCount: windows.filter((win) => win.webContents.getURL().includes("/renderer/workbench/index.html")).length,
        };
      });
      return state.overlayCount === state.displayCount ? state : null;
    });

    await new Promise((resolveWait) => setTimeout(resolveWait, 2_000));
    const idle = await electronApp.evaluate(async ({ app }) => {
      const before = process.getCPUUsage();
      await new Promise((resolveWait) => setTimeout(resolveWait, 1_000));
      const mainCpu = process.getCPUUsage(before);
      const processes = app.getAppMetrics().map((metric) => ({
        type: metric.type,
        cpuPercent: metric.cpu?.percentCPUUsage ?? 0,
        workingSetKB: metric.memory?.workingSetSize ?? 0,
      }));
      return {
        runtimeVersions: {
          node: process.versions.node,
          electron: process.versions.electron,
          chrome: process.versions.chrome,
        },
        mainCpuPercent: mainCpu.percentCPUUsage,
        totalWorkingSetKB: processes.reduce((sum, metric) => sum + metric.workingSetKB, 0),
        processes,
      };
    });

    const cursorIpc = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const overlays = BrowserWindow.getAllWindows().filter((win) =>
        !win.isDestroyed() && win.webContents.getURL().includes("/renderer/overlay/index.html"),
      );
      const testing = globalThis.__cursorDanceMainTesting;
      if (!testing) throw new Error("Desktop routing measurement bridge is unavailable");
      const targetBounds = overlays[0]?.getBounds();
      if (!targetBounds) throw new Error("No overlay is available for cursor routing measurement");
      const eventCount = 1_000;
      const targetSourceHz = 1_000;
      const targetIntervalMs = 1_000 / targetSourceHz;
      testing.resetCursorIpcCount();
      const before = process.getCPUUsage();
      const startedAt = performance.now();
      let sent = 0;
      while (sent < eventCount) {
        const elapsedMs = performance.now() - startedAt;
        const expectedCount = Math.min(eventCount, Math.floor(elapsedMs / targetIntervalMs));
        while (sent < expectedCount) {
          testing.routeCursorEvent({
            type: "mousemove",
            x: targetBounds.x + 100,
            y: targetBounds.y + 100,
            buttons: 0,
            timestamp: performance.now(),
          });
          sent += 1;
        }
        if (sent < eventCount) await new Promise((resolveWait) => setTimeout(resolveWait, 0));
      }
      testing.flushPendingMove();
      const durationMs = performance.now() - startedAt;
      const usage = process.getCPUUsage(before);
      return {
        sourceEvents: eventCount,
        targetSourceHz,
        overlayCount: overlays.length,
        activeDisplayId: testing.getActiveDisplayId(),
        ipcMessages: testing.getCursorIpcCount(),
        durationMs,
        achievedSourceHz: eventCount / (durationMs / 1_000),
        mainCpuPercent: usage.percentCPUUsage,
      };
    });

    return { coldStartToWorkbenchReadyMs, windowCounts, idle, cursorIpc };
  } finally {
    await electronApp?.close();
    await rm(userDataPath, { recursive: true, force: true });
  }
}

const result = {
  capturedAt: new Date().toISOString(),
  environment: {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
  },
  code: await Promise.all([
    measureCodeArea("desktop", ["src/desktop"]),
    measureCodeArea("extension runtimes", ["src/extension", "extension"]),
    measureCodeArea("shared effect and config", ["src/shared/effect-core", "src/shared/effect-runtime", "src/shared/config"]),
    measureCodeArea("shared Workbench UI", ["src/app/pages/theme-workbench", "src/components/ui"]),
  ]),
  bundles: {
    workbench: await measureReferencedBundle("workbench"),
    overlay: await measureReferencedBundle("overlay"),
    rendererOutputBytes: (await Promise.all((await listSourceFiles(resolve(PROJECT_ROOT, "out/renderer"))).map(async (file) => (await stat(file)).size)))
      .reduce((sum, size) => sum + size, 0),
  },
  payloads: await measureConfigPayloads(),
  runtime: staticOnly ? null : await measureRuntime(),
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
