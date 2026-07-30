import { expect, test, chromium } from "@playwright/test";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const DIST_PATH = path.join(PROJECT_ROOT, "dist");

let context;
let fixtureServer;
let fixtureUrl;
let profilePath;

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function collectPageErrors(page, errors) {
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
}

test.beforeAll(async () => {
  fixtureServer = createServer((_request, response) => {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": "default-src 'self'; script-src 'none'; style-src 'self' 'unsafe-inline'",
    });
    response.end(`<!doctype html>
      <html lang="zh-CN">
        <head><meta charset="utf-8"><title>CursorDance extension fixture</title></head>
        <body><button id="target" style="margin: 80px; width: 180px; height: 80px">触发鼠标动效</button></body>
      </html>`);
  });
  await listen(fixtureServer);
  const address = fixtureServer.address();
  fixtureUrl = `http://127.0.0.1:${address.port}/`;

  profilePath = await mkdtemp(path.join(tmpdir(), "cursordance-extension-smoke-"));
  context = await chromium.launchPersistentContext(profilePath, {
    headless: true,
    // The headless-shell binary does not load extensions. Use Playwright's
    // full Chromium build, which supports MV3 in the current headless mode.
    executablePath: chromium.executablePath(),
    args: [
      `--disable-extensions-except=${DIST_PATH}`,
      `--load-extension=${DIST_PATH}`,
    ],
  });
});

test.afterAll(async () => {
  await context?.close();
  if (fixtureServer?.listening) await close(fixtureServer);
  if (profilePath) await rm(profilePath, { recursive: true, force: true });
});

test("loads the production MV3 bundle and renders effects without CSP violations", async () => {
  const manifest = JSON.parse(await readFile(path.join(DIST_PATH, "manifest.json"), "utf8"));
  const contentBundlePath = path.join(DIST_PATH, "content-runtime/content.js");
  const contentBundle = await readFile(contentBundlePath, "utf8");

  expect(manifest.manifest_version).toBe(3);
  expect(manifest.content_scripts).toHaveLength(1);
  expect(manifest.content_scripts[0].js).toEqual(["content-runtime/content.js"]);
  expect(contentBundle).not.toMatch(/\beval\s*\(/);
  expect(contentBundle).not.toMatch(/\bnew\s+Function\s*\(/);

  const page = context.pages()[0] || await context.newPage();
  const runtimeErrors = [];
  const extensionOrigins = new Set();
  collectPageErrors(page, runtimeErrors);

  const cdp = await context.newCDPSession(page);
  cdp.on("Runtime.executionContextCreated", ({ context: executionContext }) => {
    if (executionContext.origin?.startsWith("chrome-extension://")) {
      extensionOrigins.add(executionContext.origin);
    }
  });
  await cdp.send("Runtime.enable");
  await page.goto(fixtureUrl);

  await expect(page.locator("#cursordance-root")).toBeAttached();
  await expect(page.locator("#cursordance-style")).toBeAttached();

  await page.evaluate(() => {
    window.__cursorDanceEffectClasses = [];
    const root = document.querySelector("#cursordance-root");
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement && node.matches(".cd-effect")) {
            window.__cursorDanceEffectClasses.push(node.className);
          }
        }
      }
    }).observe(root, { childList: true });
  });
  await page.locator("#target").click();
  await expect.poll(() => page.evaluate(() => window.__cursorDanceEffectClasses)).not.toEqual([]);

  await expect.poll(() => [...extensionOrigins]).not.toEqual([]);
  const extensionOrigin = [...extensionOrigins][0];
  expect(extensionOrigin).toMatch(/^chrome-extension:\/\/[a-p]{32}$/);

  for (const extensionPagePath of [manifest.action.default_popup, manifest.options_page]) {
    const extensionPage = await context.newPage();
    collectPageErrors(extensionPage, runtimeErrors);
    await extensionPage.goto(`${extensionOrigin}/${extensionPagePath}`);
    await expect(extensionPage.locator("#root")).not.toBeEmpty();
    await extensionPage.close();
  }

  expect(runtimeErrors.filter((message) => /content security policy|unsafe-eval|refused to execute/i.test(message))).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});
