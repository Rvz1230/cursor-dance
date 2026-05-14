import { expect, test } from "@playwright/test";

const CONFIG_STORAGE_KEY = "cursordance.config";
const LIVE_PREVIEW_CONFIG_STORAGE_KEY = "cursordance.livePreviewConfig";

async function clearLocalState(page) {
  await page.goto("/smoke-target.html");
  await page.evaluate(({ configKey, previewKey }) => {
    window.localStorage.removeItem(configKey);
    window.localStorage.removeItem(previewKey);
  }, {
    configKey: CONFIG_STORAGE_KEY,
    previewKey: LIVE_PREVIEW_CONFIG_STORAGE_KEY,
  });
  await page.reload();
}

async function waitForStoredTheme(page, themeId) {
  await page.waitForFunction(
    ({ configKey, expectedThemeId }) => {
      const raw = window.localStorage.getItem(configKey);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return parsed.activeThemePackId === expectedThemeId;
    },
    {
      configKey: CONFIG_STORAGE_KEY,
      expectedThemeId: themeId,
    }
  );
}

async function clickAndExpectText(page, expectedText) {
  await page.getByRole("button", { name: "点击我触发特效" }).click();
  await page.waitForFunction(
    ({ text }) =>
      Array.from(document.querySelectorAll("#cursordance-root .cd-text"))
        .some((node) => node.textContent?.trim() === text),
    { text: expectedText }
  );
  await expect(page.locator("#cursordance-root .cd-text").filter({ hasText: expectedText }).last()).toBeVisible();
}

async function clickAndExpectImageEffect(page) {
  await page.getByRole("button", { name: "点击我触发特效" }).click();
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll("#cursordance-root .cd-image-effect img")).some((node) => node.getAttribute("src")),
  );
  await expect(page.locator("#cursordance-root .cd-image-effect img").last()).toBeVisible();
}

async function clickAndExpectAnimationEffect(page) {
  await page.getByRole("button", { name: "点击我触发特效" }).click();
  await page.waitForFunction(
    () => document.querySelectorAll("#cursordance-root .cd-animation-effect").length > 0,
  );
  await expect(page.locator("#cursordance-root .cd-animation-effect").last()).toBeVisible();
}

async function waitForStoredAudioBlendMode(page, expectedMode) {
  await page.waitForFunction(
    ({ configKey, mode }) => {
      const raw = window.localStorage.getItem(configKey);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const leftClickConfig = parsed.themePacks?.find((themePack) => themePack.id === "woodfish")?.workbenchDraft?.actionConfigs?.leftClick;
      return leftClickConfig?.soundBlendMode === mode;
    },
    {
      configKey: CONFIG_STORAGE_KEY,
      mode: expectedMode,
    }
  );
}

test("popup theme selection, live preview override, and fallback to saved config stay in sync", async ({ context, page }) => {
  await clearLocalState(page);

  const popupPage = await context.newPage();
  await popupPage.goto("/popup.html");
  await popupPage.getByRole("button", { name: /Demo Highlight/ }).click();
  await waitForStoredTheme(popupPage, "demo-highlight");

  await page.reload();
  await clickAndExpectText(page, "Nice!");

  await page.reload();
  await clickAndExpectText(page, "Nice!");

  const workbenchPage = await context.newPage();
  await workbenchPage.goto("/index.html");
  await expect(workbenchPage.getByRole("button", { name: "保存" })).toBeVisible();

  const textPanel = workbenchPage.locator("section").filter({
    has: workbenchPage.getByRole("heading", { name: "飘字反馈" }),
  });
  await textPanel.getByRole("button", { name: "删除标签 Nice!" }).click();
  await textPanel.getByPlaceholder("输入一个文本标签，例如：已命中").fill("临时预览");
  await textPanel.getByRole("button", { name: "添加" }).click();

  await page.waitForFunction((previewKey) => {
    const raw = window.localStorage.getItem(previewKey);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed.themePacks?.some(
      (themePack) =>
        themePack.id === "demo-highlight"
        && themePack.workbenchDraft?.actionConfigs?.leftClick?.textContent === "临时预览"
    );
  }, LIVE_PREVIEW_CONFIG_STORAGE_KEY);

  await page.reload();
  await clickAndExpectText(page, "临时预览");

  await workbenchPage.close();
  await page.waitForFunction((previewKey) => window.localStorage.getItem(previewKey) === null, LIVE_PREVIEW_CONFIG_STORAGE_KEY);

  await page.waitForTimeout(1200);
  await page.reload();
  await clickAndExpectText(page, "Nice!");
});

test("image effect can preview live, save into config, and render in content runtime", async ({ context, page }) => {
  await clearLocalState(page);

  const workbenchPage = await context.newPage();
  await workbenchPage.goto("/index.html");
  await expect(workbenchPage.getByRole("button", { name: "保存" })).toBeVisible();

  const imagePanel = workbenchPage.locator("section").filter({
    has: workbenchPage.getByRole("heading", { name: "图片贴纸反馈" }),
  });

  await imagePanel.getByRole("switch", { name: "图片反馈开关" }).click();
  await imagePanel.getByRole("button", { name: /落章印记/ }).click();

  await page.waitForFunction((previewKey) => {
    const raw = window.localStorage.getItem(previewKey);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const leftClickConfig = parsed.themePacks?.find((themePack) => themePack.id === "woodfish")?.workbenchDraft?.actionConfigs?.leftClick;
    return Boolean(leftClickConfig?.imageEnabled && leftClickConfig?.imageDataUrl);
  }, LIVE_PREVIEW_CONFIG_STORAGE_KEY);

  await page.reload();
  await clickAndExpectImageEffect(page);

  await workbenchPage.getByRole("button", { name: "保存" }).click();
  await page.waitForFunction((configKey) => {
    const raw = window.localStorage.getItem(configKey);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const leftClickConfig = parsed.themePacks?.find((themePack) => themePack.id === "woodfish")?.workbenchDraft?.actionConfigs?.leftClick;
    return Boolean(leftClickConfig?.imageEnabled && leftClickConfig?.imageDataUrl);
  }, CONFIG_STORAGE_KEY);

  await page.reload();
  await clickAndExpectImageEffect(page);
});

test("animation effect can preview live, save into config, and render in content runtime", async ({ context, page }) => {
  await clearLocalState(page);

  const workbenchPage = await context.newPage();
  await workbenchPage.goto("/index.html");
  await expect(workbenchPage.getByRole("button", { name: "保存" })).toBeVisible();

  const animationPanel = workbenchPage.locator("section").filter({
    has: workbenchPage.getByRole("heading", { name: "基础动画反馈" }),
  });

  await animationPanel.getByRole("switch", { name: "动画反馈开关" }).click();
  await animationPanel.getByDisplayValue("聚焦脉冲").selectOption("弹跳徽记");

  await page.waitForFunction((previewKey) => {
    const raw = window.localStorage.getItem(previewKey);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const leftClickConfig = parsed.themePacks?.find((themePack) => themePack.id === "woodfish")?.workbenchDraft?.actionConfigs?.leftClick;
    return Boolean(leftClickConfig?.animationEnabled && leftClickConfig?.animationStyle === "弹跳徽记");
  }, LIVE_PREVIEW_CONFIG_STORAGE_KEY);

  await page.reload();
  await clickAndExpectAnimationEffect(page);

  await workbenchPage.getByRole("button", { name: "保存" }).click();
  await page.waitForFunction((configKey) => {
    const raw = window.localStorage.getItem(configKey);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const leftClickConfig = parsed.themePacks?.find((themePack) => themePack.id === "woodfish")?.workbenchDraft?.actionConfigs?.leftClick;
    return Boolean(leftClickConfig?.animationEnabled && leftClickConfig?.animationStyle === "弹跳徽记");
  }, CONFIG_STORAGE_KEY);

  await page.reload();
  await clickAndExpectAnimationEffect(page);
});

test("audio blend modes stay distinguishable on bilibili-like media reassertion", async ({ context, page }) => {
  await clearLocalState(page);
  await page.evaluate(() => {
    window.__CURSORDANCE_AUDIO_SITE_KEY__ = "bilibili";
    window.__cursorDanceSmokeMedia?.reset();
    window.__cursorDanceSmokeMedia?.enableReassert();
  });

  const workbenchPage = await context.newPage();
  await workbenchPage.goto("/index.html");
  await expect(workbenchPage.getByRole("button", { name: "保存" })).toBeVisible();

  const audioPanel = workbenchPage.locator("section").filter({
    has: workbenchPage.getByRole("heading", { name: "音频反馈" }),
  });

  await audioPanel.getByRole("switch", { name: "音效播放开关" }).click();
  await audioPanel.locator("select").nth(2).selectOption("保持原音量");
  await workbenchPage.getByRole("button", { name: "保存" }).click();
  await waitForStoredAudioBlendMode(workbenchPage, "保持原音量");

  await page.evaluate(() => window.__cursorDanceSmokeMedia?.reset());
  await page.getByRole("button", { name: "点击我触发特效" }).click();
  await expect.poll(async () => page.evaluate(() => window.__cursorDanceSmokeMedia?.getState())).toMatchObject({
    muted: false,
    volume: 0.72,
  });

  await audioPanel.locator("select").nth(2).selectOption("压低页面音频");
  await workbenchPage.getByRole("button", { name: "保存" }).click();
  await waitForStoredAudioBlendMode(workbenchPage, "压低页面音频");

  await page.evaluate(() => {
    window.__cursorDanceSmokeMedia?.reset();
    window.__cursorDanceSmokeMedia?.enableReassert();
  });
  await page.getByRole("button", { name: "点击我触发特效" }).click();
  await expect.poll(async () => page.evaluate(() => window.__cursorDanceSmokeMedia?.getState())).toMatchObject({
    muted: false,
    volume: 0.035,
  });

  await audioPanel.locator("select").nth(2).selectOption("仅插件音效");
  await workbenchPage.getByRole("button", { name: "保存" }).click();
  await waitForStoredAudioBlendMode(workbenchPage, "仅插件音效");

  await page.evaluate(() => {
    window.__cursorDanceSmokeMedia?.reset();
    window.__cursorDanceSmokeMedia?.enableReassert();
  });
  await page.getByRole("button", { name: "点击我触发特效" }).click();
  await expect.poll(async () => page.evaluate(() => window.__cursorDanceSmokeMedia?.getState())).toMatchObject({
    muted: true,
    volume: 0,
  });

  await page.waitForFunction(
    () => {
      const state = window.__cursorDanceSmokeMedia?.getState();
      return state?.muted === false && Math.abs((state?.volume || 0) - 0.72) < 0.001;
    },
    null,
    { timeout: 4000 }
  );
});
