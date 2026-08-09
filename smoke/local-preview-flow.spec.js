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
      return parsed.activeThemeId === expectedThemeId;
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
      const leftClickConfig = parsed.themes?.find(
        (theme) => theme.id === parsed.activeThemeId,
      )?.actionConfigs?.leftClick;
      return leftClickConfig?.soundBlendMode === mode;
    },
    {
      configKey: CONFIG_STORAGE_KEY,
      mode: expectedMode,
    }
  );
}

async function selectRadixOption(page, scope, index, optionName) {
  await revealPanelSettings(scope);
  await scope.getByRole("combobox").nth(index).click();
  await page.getByRole("option", { name: optionName }).click();
}

async function revealPanelSettings(panel) {
  const button = panel.getByRole("button", { name: /^(全部|其余) \d+ 项(?:设置)?/ });
  if (await button.isVisible() && await button.getAttribute("aria-expanded") !== "true") await button.click();
}

function panelByName(page, name) {
  return page.getByRole("region", { name });
}

test("popup theme selection, live preview override, and fallback to saved config stay in sync", async ({ context, page }) => {
  await clearLocalState(page);

  const popupPage = await context.newPage();
  await popupPage.goto("/popup.html");
  await popupPage.getByRole("button", { name: /熔金/ }).click();
  await waitForStoredTheme(popupPage, "molten");

  await page.reload();
  await clickAndExpectText(page, "+1");

  await page.reload();
  await clickAndExpectText(page, "+1");

  const workbenchPage = await context.newPage();
  await workbenchPage.goto("/index.html");
  await expect(workbenchPage.getByRole("button", { name: "主题与效果", exact: true })).toBeVisible();

  const textPanel = panelByName(workbenchPage, /^飘字$/);
  await selectRadixOption(workbenchPage, textPanel, 0, "文本飘字");
  await revealPanelSettings(textPanel);
  const deleteTagButtons = textPanel.getByRole("button", { name: /^删除标签 / });
  while (await deleteTagButtons.count()) await deleteTagButtons.first().click();
  await textPanel.getByPlaceholder("输入一个文本标签，例如：已命中").fill("临时预览");
  await textPanel.getByRole("button", { name: "添加" }).click();

  await page.waitForFunction((previewKey) => {
    const raw = window.localStorage.getItem(previewKey);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed.themes?.some(
      (theme) =>
        theme.id === "molten"
        && theme.actionConfigs?.leftClick?.textContent === "临时预览"
    );
  }, LIVE_PREVIEW_CONFIG_STORAGE_KEY);

  await page.reload();
  await clickAndExpectText(page, "临时预览");

  await workbenchPage.close();
  await page.waitForFunction((previewKey) => window.localStorage.getItem(previewKey) === null, LIVE_PREVIEW_CONFIG_STORAGE_KEY);

  await page.waitForTimeout(1200);
  await page.reload();
  await clickAndExpectText(page, "+1");
});

test("saved cursor trail runs in the standalone Web runtime page", async ({ context, page }) => {
  await clearLocalState(page);

  const workbenchPage = await context.newPage();
  await workbenchPage.goto("/index.html");
  await expect(workbenchPage.getByRole("button", { name: "网页试用" })).toBeVisible();

  const trailPanel = panelByName(workbenchPage, /^鼠标拖尾$/);
  await trailPanel.getByRole("switch", { name: "鼠标拖尾开关" }).click();
  await trailPanel.getByRole("radio", { name: "星尘", exact: true }).click();

  const previewStage = workbenchPage.getByTestId("trail-preview-stage");
  const editorState = previewStage.locator("[data-trail-editor-state]");
  await previewStage.getByRole("button", { name: "录制路径", exact: true }).click();
  await expect(editorState).toHaveAttribute("data-trail-editor-state", "armed");
  const stageBox = await previewStage.boundingBox();
  if (!stageBox) throw new Error("Trail preview stage has no layout box");
  await workbenchPage.mouse.move(stageBox.x + stageBox.width * 0.2, stageBox.y + stageBox.height * 0.55);
  await workbenchPage.mouse.down();
  await workbenchPage.mouse.move(stageBox.x + stageBox.width * 0.45, stageBox.y + stageBox.height * 0.25, { steps: 8 });
  await workbenchPage.mouse.move(stageBox.x + stageBox.width * 0.78, stageBox.y + stageBox.height * 0.62, { steps: 10 });
  await workbenchPage.mouse.up();
  await expect(editorState).toHaveAttribute("data-trail-editor-state", "playing");
  await previewStage.getByRole("button", { name: "暂停轨迹循环" }).click();
  await expect(editorState).toHaveAttribute("data-trail-editor-state", "paused");
  await previewStage.getByRole("button", { name: "播放轨迹循环" }).click();
  await expect(editorState).toHaveAttribute("data-trail-editor-state", "playing");

  await revealPanelSettings(trailPanel);
  await trailPanel.getByRole("button", { name: /^尾部颜色：/ }).click();
  const tailColorInput = workbenchPage.getByLabel("输入尾部颜色十六进制值");
  await tailColorInput.fill("#123456");
  await tailColorInput.press("Enter");
  await tailColorInput.press("Escape");
  await selectRadixOption(workbenchPage, trailPanel, 0, "滤色");
  await selectRadixOption(workbenchPage, trailPanel, 1, "省电");
  await trailPanel.getByRole("spinbutton", { name: "尾部宽度" }).fill("3.7");
  await trailPanel.getByRole("spinbutton", { name: "尾部宽度" }).press("Enter");
  await trailPanel.getByRole("spinbutton", { name: "中段透明度" }).fill("47");
  await trailPanel.getByRole("spinbutton", { name: "中段透明度" }).press("Enter");
  await trailPanel.getByRole("spinbutton", { name: "光标附近宽度" }).fill("11.2");
  await trailPanel.getByRole("spinbutton", { name: "光标附近宽度" }).press("Enter");
  await expect(editorState).toHaveAttribute("data-trail-editor-state", "playing");
  await workbenchPage.getByRole("button", { name: "保存到浏览器" }).click();

  await expect.poll(() => workbenchPage.evaluate((configKey) => {
    const raw = window.localStorage.getItem(configKey);
    if (!raw) return null;
    const config = JSON.parse(raw);
    const theme = config.themes?.find((item) => item.id === config.activeThemeId);
    return theme?.atmosphere?.trail ?? null;
  }, CONFIG_STORAGE_KEY)).toMatchObject({
    enabled: true,
    shape: "stardust",
    blendMode: "screen",
    quality: "eco",
    turnResponse: 88,
    gestureResponse: 72,
    colors: ["#123456", "#FB7185"],
    width: 11.2,
    segments: {
      tail: { color: "#123456", width: 3.7, opacity: 27 },
      middle: { color: "#F88848", width: 4.34, opacity: 47 },
      head: { color: "#FB7185", width: 11.2, opacity: 78 },
    },
  });

  await workbenchPage.getByRole("button", { name: "网页试用" }).click();
  const runtimePage = workbenchPage;
  await runtimePage.waitForLoadState("domcontentloaded");
  await expect(runtimePage).toHaveURL(/\/runtime-preview\.html$/);
  await expect(runtimePage.locator('canvas[data-cursordance-trail="true"]')).toBeVisible();

  await runtimePage.mouse.move(260, 360);
  await runtimePage.mouse.move(760, 360, { steps: 12 });
  await runtimePage.mouse.move(760, 700, { steps: 8 });
  await runtimePage.waitForFunction(() => {
    const canvas = document.querySelector('canvas[data-cursordance-trail="true"]');
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    const context2d = canvas.getContext("2d");
    if (!context2d) return false;
    const pixels = context2d.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] > 0) return true;
    }
    return false;
  });
});

test("image effect can preview live, save into config, and render in content runtime", async ({ context, page }) => {
  await clearLocalState(page);

  const workbenchPage = await context.newPage();
  await workbenchPage.goto("/index.html");
  await expect(workbenchPage.getByRole("button", { name: "主题与效果", exact: true })).toBeVisible();

  const imagePanel = panelByName(workbenchPage, /^贴纸$/);

  await imagePanel.getByRole("switch", { name: "贴纸开关" }).click();
  await revealPanelSettings(imagePanel);
  await imagePanel.getByRole("button", { name: /落章印记/ }).click();

  await page.waitForFunction((previewKey) => {
    const raw = window.localStorage.getItem(previewKey);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const leftClickConfig = parsed.themes?.find(
      (theme) => theme.id === parsed.activeThemeId,
    )?.actionConfigs?.leftClick;
    return Boolean(leftClickConfig?.imageEnabled && leftClickConfig?.imageDataUrl);
  }, LIVE_PREVIEW_CONFIG_STORAGE_KEY);

  await page.reload();
  await clickAndExpectImageEffect(page);

  await workbenchPage.getByRole("button", { name: "保存到浏览器" }).click();
  await page.waitForFunction((configKey) => {
    const raw = window.localStorage.getItem(configKey);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const leftClickConfig = parsed.themes?.find(
      (theme) => theme.id === parsed.activeThemeId,
    )?.actionConfigs?.leftClick;
    return Boolean(leftClickConfig?.imageEnabled && leftClickConfig?.imageDataUrl);
  }, CONFIG_STORAGE_KEY);

  await page.reload();
  await clickAndExpectImageEffect(page);
});

test("animation effect can preview live, save into config, and render in content runtime", async ({ context, page }) => {
  await clearLocalState(page);

  const workbenchPage = await context.newPage();
  await workbenchPage.goto("/index.html");
  await expect(workbenchPage.getByRole("button", { name: "主题与效果", exact: true })).toBeVisible();

  const animationPanel = panelByName(workbenchPage, /^动画$/);

  await animationPanel.getByRole("switch", { name: "动画开关" }).click();
  await selectRadixOption(workbenchPage, animationPanel, 0, "弹跳徽记");

  await page.waitForFunction((previewKey) => {
    const raw = window.localStorage.getItem(previewKey);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const leftClickConfig = parsed.themes?.find(
      (theme) => theme.id === parsed.activeThemeId,
    )?.actionConfigs?.leftClick;
    return Boolean(leftClickConfig?.animationEnabled && leftClickConfig?.animationStyle === "弹跳徽记");
  }, LIVE_PREVIEW_CONFIG_STORAGE_KEY);

  await page.reload();
  await clickAndExpectAnimationEffect(page);

  await workbenchPage.getByRole("button", { name: "保存到浏览器" }).click();
  await page.waitForFunction((configKey) => {
    const raw = window.localStorage.getItem(configKey);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const leftClickConfig = parsed.themes?.find(
      (theme) => theme.id === parsed.activeThemeId,
    )?.actionConfigs?.leftClick;
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
  await expect(workbenchPage.getByRole("button", { name: "主题与效果", exact: true })).toBeVisible();

  const audioPanel = panelByName(workbenchPage, /^音效$/);

  await audioPanel.getByRole("switch", { name: "音效开关" }).click();
  await selectRadixOption(workbenchPage, audioPanel, 1, "保持原音量");
  await workbenchPage.getByRole("button", { name: "保存到浏览器" }).click();
  await waitForStoredAudioBlendMode(workbenchPage, "保持原音量");

  await page.evaluate(() => window.__cursorDanceSmokeMedia?.reset());
  await page.getByRole("button", { name: "点击我触发特效" }).click();
  await expect.poll(async () => page.evaluate(() => window.__cursorDanceSmokeMedia?.getState())).toMatchObject({
    muted: false,
    volume: 0.72,
  });

  await selectRadixOption(workbenchPage, audioPanel, 1, "压低页面音频");
  await workbenchPage.getByRole("button", { name: "保存到浏览器" }).click();
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

  await selectRadixOption(workbenchPage, audioPanel, 1, "仅插件音效");
  await workbenchPage.getByRole("button", { name: "保存到浏览器" }).click();
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
  await expect(workbenchPage.getByRole("button", { name: "主题与效果", exact: true })).toBeVisible();

  await workbenchPage.getByRole("button", { name: "新建主题" }).click();
  await expect(workbenchPage.getByRole("dialog", { name: "新建主题" })).toBeVisible();
  await workbenchPage.keyboard.press("Escape");
  await expect(workbenchPage.getByRole("dialog", { name: "新建主题" })).toBeHidden();

  await workbenchPage.getByRole("button", { name: "新建主题" }).click();
  await workbenchPage.getByLabel("主题名称").fill("Smoke UX Theme");
  await workbenchPage.getByRole("button", { name: "创建主题" }).click();
  await expect(workbenchPage.getByText("已创建主题", { exact: true })).toBeVisible();

  // The 960px baseline keeps the theme library compact until the user expands it.
  await expect(workbenchPage.getByRole("button", { name: "展开主题库" })).toBeVisible();
  await workbenchPage.getByRole("button", { name: "展开主题库" }).click();
  const themeLibrary = workbenchPage.getByRole("listbox", { name: "主题库" });
  const themeSearch = workbenchPage.getByRole("textbox", { name: "搜索主题" });
  await expect(themeLibrary.getByRole("option")).toHaveCount(5);
  const themeSignatures = await themeLibrary.getByRole("option").evaluateAll((options) =>
    options.map((option) => {
      const ripple = option.querySelector("svg circle[stroke]")?.getAttribute("stroke");
      const text = option.querySelector('svg rect[x="30"]')?.getAttribute("fill");
      return `${ripple}|${text}`;
    }),
  );
  expect(new Set(themeSignatures).size).toBeGreaterThan(1);
  await expect.poll(() => themeLibrary.getByRole("option").evaluateAll((options) =>
    options.filter((option) => option.tabIndex === 0).length,
  )).toBe(1);

  await themeSearch.fill("Smoke UX Theme");
  await expect(themeLibrary.getByRole("option")).toHaveCount(1);
  await expect(workbenchPage.getByText("1/5", { exact: true })).toBeVisible();
  await workbenchPage.getByRole("button", { name: "清空搜索" }).click();
  await themeSearch.press("ArrowDown");
  await expect(themeLibrary.getByRole("option").first()).toBeFocused();
  await themeLibrary.getByRole("option").first().press("End");
  await expect(themeLibrary.getByRole("option").last()).toBeFocused();

  await workbenchPage.getByRole("button", { name: "Smoke UX Theme 更多操作" }).click();
  await workbenchPage.getByRole("button", { name: "复制为自定义主题" }).click();
  await expect(workbenchPage.getByText("已复制主题", { exact: true })).toBeVisible();
  await expect(workbenchPage.getByText(/^已复制为/)).toHaveCount(0);

  await workbenchPage.getByRole("button", { name: /Smoke UX Theme.*更多操作/ }).last().click();
  await workbenchPage.getByRole("button", { name: "删除" }).click();
  await expect(workbenchPage.getByRole("alertdialog", { name: "删除主题？" })).toBeVisible();
  await workbenchPage.getByRole("button", { name: "取消" }).click();
  await expect(workbenchPage.getByRole("alertdialog", { name: "删除主题？" })).toBeHidden();

  await workbenchPage.getByRole("button", { name: /Smoke UX Theme.*更多操作/ }).last().click();
  await workbenchPage.getByRole("button", { name: "删除" }).click();
  await workbenchPage.getByRole("button", { name: "删除主题" }).click();
  await expect(workbenchPage.getByText("已移除主题", { exact: true })).toBeVisible();

  const textPanel = panelByName(workbenchPage, /^飘字$/);

  await workbenchPage.getByRole("button", { name: /折叠飘字|展开飘字/ }).click();
  await workbenchPage.getByRole("button", { name: /折叠飘字|展开飘字/ }).click();
  await revealPanelSettings(textPanel);
  await textPanel.getByRole("button", { name: /^颜色：#[0-9A-F]{6}$/i }).click();
  const colorHexInput = workbenchPage.getByLabel("输入颜色十六进制值");
  await colorHexInput.fill("#0284C7");
  await colorHexInput.press("Enter");
  await expect(workbenchPage.getByText("已更新飘字颜色", { exact: true })).toBeVisible();

  const fontSizeInput = textPanel.getByRole("spinbutton", { name: "字号" });
  await fontSizeInput.fill("26");
  await fontSizeInput.blur();

  await workbenchPage.getByRole("button", { name: "保存到浏览器" }).click();
  await expect(workbenchPage.getByLabel("Notifications (F8)").getByText("已保存到浏览器", { exact: true })).toBeVisible();

  await workbenchPage.waitForFunction((configKey) => {
    const raw = window.localStorage.getItem(configKey);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const selectedId = parsed.activeThemeId;
    const leftClickConfig = parsed.themes?.find((theme) => theme.id === selectedId)?.actionConfigs?.leftClick;
    return leftClickConfig?.textColor === "#0284C7" && leftClickConfig?.fontSize === 26;
  }, CONFIG_STORAGE_KEY);
});

test("AI assistant conversation panel opens and renders its message surface", async ({ page }) => {
  await clearLocalState(page);
  await page.goto("/index.html");

  const toggle = page.getByRole("button", { name: "AI 助手", exact: true });
  await toggle.click();
  const aiPanel = page.locator("section").filter({ hasText: "AI 方案助手" });

  await expect(aiPanel.getByText("描述你想要的鼠标反馈，我会直接生成或修改当前动作配置。", { exact: true })).toBeVisible();
  await expect(aiPanel.getByLabel("描述想要的鼠标效果")).toBeVisible();
  await aiPanel.getByRole("button", { name: "快速", exact: true }).click();
  await aiPanel.getByRole("option", { name: /Agent 模式/ }).click();
  await expect(aiPanel.getByRole("button", { name: "Agent", exact: true })).toBeVisible();

  await toggle.click();
  await expect(page.getByLabel("描述想要的鼠标效果")).toBeHidden();

  await toggle.click();
  await expect(aiPanel.getByRole("button", { name: "Agent", exact: true })).toBeVisible();
});
