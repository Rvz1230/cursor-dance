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

async function selectRadixOption(page, scope, index, optionName) {
  await scope.getByRole("combobox").nth(index).click();
  await page.getByRole("option", { name: optionName }).click();
}

function panelByName(page, name) {
  return page.getByRole("button", { name }).locator("xpath=ancestor::*[contains(@class,'rounded-2xl')][1]");
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

  const textPanel = panelByName(workbenchPage, /飘字反馈/);
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

  const imagePanel = panelByName(workbenchPage, /图片贴纸反馈/);

  await imagePanel.getByRole("switch", { name: "图片反馈开关" }).click();
  await workbenchPage.getByRole("button", { name: /图片贴纸反馈/ }).click();
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

  const animationPanel = panelByName(workbenchPage, /基础动画反馈/);

  await animationPanel.getByRole("switch", { name: "动画反馈开关" }).click();
  await workbenchPage.getByRole("button", { name: /基础动画反馈/ }).click();
  await selectRadixOption(workbenchPage, animationPanel, 0, "弹跳徽记");

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

  const audioPanel = panelByName(workbenchPage, /音频反馈/);

  await audioPanel.getByRole("switch", { name: "音效播放开关" }).click();
  await selectRadixOption(workbenchPage, audioPanel, 2, "保持原音量");
  await workbenchPage.getByRole("button", { name: "保存" }).click();
  await waitForStoredAudioBlendMode(workbenchPage, "保持原音量");

  await page.evaluate(() => window.__cursorDanceSmokeMedia?.reset());
  await page.getByRole("button", { name: "点击我触发特效" }).click();
  await expect.poll(async () => page.evaluate(() => window.__cursorDanceSmokeMedia?.getState())).toMatchObject({
    muted: false,
    volume: 0.72,
  });

  await selectRadixOption(workbenchPage, audioPanel, 2, "压低页面音频");
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

  await selectRadixOption(workbenchPage, audioPanel, 2, "仅插件音效");
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

test("workbench dialogs, save toast, color picker, and slider controls are usable", async ({ context, page }) => {
  await clearLocalState(page);

  const workbenchPage = await context.newPage();
  await workbenchPage.goto("/index.html");
  await expect(workbenchPage.getByRole("button", { name: "保存" })).toBeVisible();

  await workbenchPage.getByRole("button", { name: "新建" }).click();
  await expect(workbenchPage.getByRole("dialog", { name: "主题管理" })).toBeVisible();
  await workbenchPage.keyboard.press("Escape");
  await expect(workbenchPage.getByRole("dialog", { name: "主题管理" })).toBeHidden();

  await workbenchPage.getByRole("button", { name: "新建" }).click();
  await workbenchPage.getByLabel("主题名称").fill("Smoke UX Theme");
  await workbenchPage.getByRole("button", { name: "创建主题" }).click();
  await expect(workbenchPage.getByText("已创建主题")).toBeVisible();

  await workbenchPage.getByRole("button", { name: "复制" }).click();
  await expect(workbenchPage.getByText("已复制主题")).toBeVisible();
  await expect(workbenchPage.getByText(/^已复制为/)).toHaveCount(0);

  await workbenchPage.getByRole("button", { name: "删除" }).first().click();
  await expect(workbenchPage.getByRole("alertdialog", { name: "删除主题？" })).toBeVisible();
  await workbenchPage.getByRole("button", { name: "取消" }).click();
  await expect(workbenchPage.getByRole("alertdialog", { name: "删除主题？" })).toBeHidden();

  await workbenchPage.getByRole("button", { name: "删除" }).first().click();
  await workbenchPage.getByRole("button", { name: "删除主题" }).click();
  await expect(workbenchPage.getByText("已移除主题")).toBeVisible();

  const textPanel = workbenchPage.getByRole("button", { name: /飘字反馈/ }).locator("xpath=ancestor::*[contains(@class,'rounded-2xl')][1]");

  await workbenchPage.getByRole("button", { name: /飘字反馈/ }).click();
  await workbenchPage.getByRole("button", { name: /飘字反馈/ }).click();
  await textPanel.getByRole("button", { name: /#B45309/i }).click();
  const colorHexInput = workbenchPage.getByLabel("输入飘字颜色十六进制值");
  await colorHexInput.fill("#0284C7");
  await colorHexInput.press("Enter");
  await expect(workbenchPage.getByText("已更新飘字颜色")).toBeVisible();

  const fontSizeInput = textPanel.getByRole("spinbutton", { name: "飘字大小" });
  await fontSizeInput.fill("26");
  await fontSizeInput.blur();

  await workbenchPage.getByRole("button", { name: "保存" }).click();
  await expect(workbenchPage.getByText("已保存到扩展配置")).toBeVisible();

  await workbenchPage.waitForFunction((configKey) => {
    const raw = window.localStorage.getItem(configKey);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const selectedId = parsed.activeThemePackId;
    const leftClickConfig = parsed.themePacks?.find((themePack) => themePack.id === selectedId)?.workbenchDraft?.actionConfigs?.leftClick;
    return leftClickConfig?.textColor === "#0284C7" && leftClickConfig?.fontSize === 26;
  }, CONFIG_STORAGE_KEY);
});
