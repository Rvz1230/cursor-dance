(function cursorDanceDefaultConfig() {
  function cloneValue(value) {
    return JSON.parse(JSON.stringify(value));
  }

  const DEFAULT_CURSOR_STATE_IDS = [
    "default",
    "pointer",
    "text",
    "help",
    "wait",
    "notAllowed",
  ];

  function createDefaultCursorStates() {
    return DEFAULT_CURSOR_STATE_IDS.reduce((states, stateId) => {
      states[stateId] = {
        mode: "inherit",
        actionId: "leftClick",
        imageDataUrl: "",
        hotspotX: 16,
        hotspotY: 32,
        size: 48,
      };
      return states;
    }, {});
  }

  function normalizeCursorStateConfig(stateConfig, fallbackStateConfig) {
    return {
      ...(fallbackStateConfig || {}),
      ...(stateConfig && typeof stateConfig === "object" && !Array.isArray(stateConfig) ? stateConfig : {}),
      mode: stateConfig?.mode === "override" ? "override" : (fallbackStateConfig?.mode || "inherit"),
      actionId: typeof stateConfig?.actionId === "string" ? stateConfig.actionId : (fallbackStateConfig?.actionId || "leftClick"),
      imageDataUrl: typeof stateConfig?.imageDataUrl === "string" ? stateConfig.imageDataUrl : (fallbackStateConfig?.imageDataUrl || ""),
      hotspotX: Number.isFinite(stateConfig?.hotspotX) ? stateConfig.hotspotX : (fallbackStateConfig?.hotspotX ?? 16),
      hotspotY: Number.isFinite(stateConfig?.hotspotY) ? stateConfig.hotspotY : (fallbackStateConfig?.hotspotY ?? 32),
      size: Number.isFinite(stateConfig?.size) ? stateConfig.size : (fallbackStateConfig?.size ?? 48),
    };
  }

  function mergeCursorStates(fallbackCursorStates, cursorStates) {
    const fallback = fallbackCursorStates || createDefaultCursorStates();
    const nextStates = {
      ...fallback,
    };

    DEFAULT_CURSOR_STATE_IDS.forEach((stateId) => {
      nextStates[stateId] = normalizeCursorStateConfig(cursorStates?.[stateId], fallback[stateId]);
    });

    Object.entries(cursorStates || {}).forEach(([stateId, stateConfig]) => {
      if (Object.prototype.hasOwnProperty.call(nextStates, stateId)) return;
      nextStates[stateId] = normalizeCursorStateConfig(stateConfig, { mode: "inherit" });
    });

    return nextStates;
  }

  const THEME_ID_ALIASES = {
    "cute-pink": "woodfish",
  };

  function normalizeThemePackId(themePackId) {
    if (typeof themePackId !== "string") return themePackId;
    return THEME_ID_ALIASES[themePackId] || themePackId;
  }

  const defaultThemePackDefinitions = [
    {
      id: "woodfish",
      name: "木鱼方案",
      description: "功德 +1、声音反馈和轻波纹，适合默认工作流。",
      kind: "custom",
      cursorStates: createDefaultCursorStates(),
      behavior: {
        click: {
          enabled: true,
          trigger: {
            button: "left",
            cooldownMs: 80,
          },
          effects: {
            text: {
              enabled: true,
              content: "功德 +1",
              color: "#b45309",
              fontSize: 24,
              fontWeight: 800,
              offsetX: 0,
              offsetY: -52,
              durationMs: 1000,
            },
            ripple: {
              enabled: true,
              color: "#fbbf24",
              size: 104,
              durationMs: 820,
            },
            particle: {
              enabled: true,
              color: "#f59e0b",
              count: 18,
              size: 9,
              baseDistance: 56,
              distanceStep: 10,
              durationMs: 760,
            },
          },
        },
      },
    },
    {
      id: "lite-default",
      name: "轻量默认风",
      description: "保留反馈但更克制，适合日常浏览。",
      kind: "builtin",
      cursorStates: createDefaultCursorStates(),
      behavior: {
        click: {
          enabled: true,
          trigger: {
            button: "left",
            cooldownMs: 110,
          },
          effects: {
            text: {
              enabled: true,
              content: "收到",
              color: "#475569",
              fontSize: 22,
              fontWeight: 700,
              offsetX: 10,
              offsetY: -48,
              durationMs: 760,
            },
            ripple: {
              enabled: true,
              color: "#94a3b8",
              size: 96,
              durationMs: 620,
            },
            particle: {
              enabled: true,
              color: "#cbd5e1",
              count: 8,
              size: 5,
              baseDistance: 34,
              distanceStep: 6,
              durationMs: 540,
            },
          },
        },
      },
    },
    {
      id: "demo-highlight",
      name: "Demo Highlight",
      description: "更亮、更大，适合演示和录屏。",
      kind: "builtin",
      cursorStates: createDefaultCursorStates(),
      behavior: {
        click: {
          enabled: true,
          trigger: {
            button: "left",
            cooldownMs: 60,
          },
          effects: {
            text: {
              enabled: true,
              content: "Nice!",
              color: "#7c3aed",
              fontSize: 30,
              fontWeight: 900,
              offsetX: 14,
              offsetY: -62,
              durationMs: 1020,
            },
            ripple: {
              enabled: true,
              color: "#facc15",
              size: 138,
              durationMs: 900,
            },
            particle: {
              enabled: true,
              color: "#f59e0b",
              count: 18,
              size: 9,
              baseDistance: 62,
              distanceStep: 12,
              durationMs: 860,
            },
          },
        },
      },
    },
    {
      id: "petal",
      name: "花瓣流光",
      description: "柔和粒子和粉色飘字，适合轻互动主题。",
      kind: "custom",
      cursorStates: createDefaultCursorStates(),
      behavior: {
        click: {
          enabled: true,
          trigger: {
            button: "left",
            cooldownMs: 90,
          },
          effects: {
            text: {
              enabled: true,
              content: "花开",
              color: "#be185d",
              fontSize: 24,
              fontWeight: 700,
              offsetX: 0,
              offsetY: -52,
              durationMs: 920,
            },
            ripple: {
              enabled: true,
              color: "#f9a8d4",
              size: 108,
              durationMs: 760,
            },
            particle: {
              enabled: true,
              color: "#f472b6",
              count: 16,
              size: 8,
              baseDistance: 50,
              distanceStep: 8,
              durationMs: 720,
            },
          },
        },
      },
    },
  ];

  function createDefaultThemePacks() {
    return defaultThemePackDefinitions.map((pack) => cloneValue(pack));
  }

  function mergeThemePackWithFallback(fallbackPack, pack) {
    const normalizedId = normalizeThemePackId(pack?.id || fallbackPack?.id);
    return {
      ...fallbackPack,
      ...pack,
      id: normalizedId,
      kind: pack?.kind || fallbackPack.kind || "custom",
      cursorStates: mergeCursorStates(fallbackPack.cursorStates, pack?.cursorStates),
      behavior: {
        ...(fallbackPack.behavior || {}),
        ...(pack?.behavior || {}),
        click: {
          ...(fallbackPack.behavior?.click || {}),
          ...(pack?.behavior?.click || {}),
          trigger: {
            ...(fallbackPack.behavior?.click?.trigger || {}),
            ...(pack?.behavior?.click?.trigger || {}),
          },
          effects: {
            ...(fallbackPack.behavior?.click?.effects || {}),
            ...(pack?.behavior?.click?.effects || {}),
            text: {
              ...(fallbackPack.behavior?.click?.effects?.text || {}),
              ...(pack?.behavior?.click?.effects?.text || {}),
            },
            ripple: {
              ...(fallbackPack.behavior?.click?.effects?.ripple || {}),
              ...(pack?.behavior?.click?.effects?.ripple || {}),
            },
            particle: {
              ...(fallbackPack.behavior?.click?.effects?.particle || {}),
              ...(pack?.behavior?.click?.effects?.particle || {}),
            },
          },
        },
      },
    };
  }

  function normalizeSiteRule(rule) {
    if (typeof rule === "string") {
      return {
        mode: rule,
      };
    }
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
      return {
        mode: "inherit",
      };
    }
    return {
      mode: typeof rule.mode === "string" ? rule.mode : "inherit",
      themePackId: typeof rule.themePackId === "string" ? rule.themePackId : undefined,
    };
  }

  function normalizeSiteRules(siteRules, fallbackSiteRules) {
    const mergedByHost = {
      ...((fallbackSiteRules && fallbackSiteRules.byHost) || {}),
    };
    Object.entries((siteRules && siteRules.byHost) || {}).forEach(([host, rule]) => {
      mergedByHost[host] = normalizeSiteRule(rule);
    });
    return {
      ...(fallbackSiteRules || {}),
      ...(siteRules || {}),
      byHost: mergedByHost,
    };
  }

  function normalizeEditorPrefs(editorPrefs, fallbackEditorPrefs) {
    return {
      mode: editorPrefs?.mode === "advanced" ? "advanced" : (fallbackEditorPrefs?.mode || "simple"),
      lastWorkspace: editorPrefs?.lastWorkspace || fallbackEditorPrefs?.lastWorkspace || "workspace",
      lastActionId: editorPrefs?.lastActionId || fallbackEditorPrefs?.lastActionId || "leftClick",
      lastCursorState: editorPrefs?.lastCursorState || fallbackEditorPrefs?.lastCursorState || "default",
    };
  }

  function inferTextKindFromEffect(textEffect, fallbackKind = "数字飘字") {
    if (textEffect?.kind === "text") return "文本飘字";
    if (textEffect?.kind === "number") return "数字飘字";

    const tags = Array.isArray(textEffect?.tags) ? textEffect.tags.filter(Boolean) : [];
    if (tags.length > 1) return "文本飘字";

    const content = typeof textEffect?.content === "string" ? textEffect.content.trim() : "";
    if (!content) return fallbackKind;
    if (content.includes("${number}")) return "数字飘字";

    const compactContent = content.replace(/\s+/g, "");
    if (/^[+\-]?\d+$/.test(compactContent)) return "数字飘字";
    if (/^[+\-]?[一二三四五六七八九十百千万]+$/.test(compactContent)) return "数字飘字";
    if (/^(one|two|three|four|five|six|seven|eight|nine|ten)$/i.test(compactContent)) return "数字飘字";

    return "文本飘字";
  }

  function resolveNumberStyleFromEffect(textEffect, fallbackStyle) {
    const numberStyle = String(textEffect?.numberStyle || "").toLowerCase();
    if (numberStyle.includes("zh") || numberStyle.includes("cn") || numberStyle.includes("中文")) {
      return "中文数字 (一, 二, 三)";
    }
    if (numberStyle.includes("en") || numberStyle.includes("英文")) {
      return "英文单词 (one, two, three)";
    }
    if (numberStyle.includes("arabic") || numberStyle.includes("digit") || numberStyle.includes("阿拉伯")) {
      return "阿拉伯数字 (1, 2, 3)";
    }
    return fallbackStyle;
  }

  function resolveTextModeFromEffect(textEffect, fallbackMode) {
    if (textEffect?.mode === "template") return "模板模式";
    if (textEffect?.mode === "default") return "默认模式 (+1)";
    if (typeof textEffect?.template === "string" && textEffect.template.includes("${number}")) return "模板模式";
    if (typeof textEffect?.content === "string" && textEffect.content.includes("${number}")) return "模板模式";
    return fallbackMode;
  }

  function resolveActionTextConfigFromEffect(baseActionConfig, textEffect) {
    const textKind = inferTextKindFromEffect(textEffect, baseActionConfig.textKind);
    const textStyle = resolveNumberStyleFromEffect(textEffect, baseActionConfig.textStyle);
    const textMode = resolveTextModeFromEffect(textEffect, baseActionConfig.textMode);
    const textTags = Array.isArray(textEffect?.tags) ? textEffect.tags.filter(Boolean) : [];
    const primaryText = typeof textEffect?.content === "string" ? textEffect.content.trim() : "";

    if (textKind === "文本飘字") {
      const orderedTags = Array.from(new Set([primaryText, ...textTags, ...(baseActionConfig.textTags || [])].filter(Boolean)));
      return {
        textKind,
        textStyle,
        textMode,
        textTemplate: baseActionConfig.textTemplate,
        textContent: orderedTags[0] ?? "",
        textTags: orderedTags,
        textTagPlayMode: textEffect?.tagPlayMode || baseActionConfig.textTagPlayMode,
        comboEnabled: false,
      };
    }

    return {
      textKind,
      textStyle,
      textMode,
      textTemplate:
        typeof textEffect?.template === "string" && textEffect.template
          ? textEffect.template
          : (typeof textEffect?.content === "string" && textEffect.content.includes("${number}")
            ? textEffect.content
            : baseActionConfig.textTemplate),
      textContent: "",
      textTags: Array.isArray(baseActionConfig.textTags) ? baseActionConfig.textTags : [],
      textTagPlayMode: baseActionConfig.textTagPlayMode,
      comboEnabled: textEffect?.comboEnabled ?? baseActionConfig.comboEnabled,
    };
  }

  function buildStoredTextEffectPayload(actionConfig, orderedTextTags) {
    const textContent =
      actionConfig.textKind === "数字飘字"
        ? actionConfig.textMode === "模板模式"
          ? actionConfig.textTemplate.replace("${number}", "1")
          : ""
        : orderedTextTags[0] || actionConfig.textContent || "";

    return {
      kind: actionConfig.textKind === "文本飘字" ? "text" : "number",
      numberStyle: actionConfig.textStyle,
      mode: actionConfig.textMode === "模板模式" ? "template" : "default",
      template: actionConfig.textTemplate,
      tags: orderedTextTags,
      tagPlayMode: actionConfig.textTagPlayMode,
      comboEnabled: actionConfig.comboEnabled,
      content: textContent,
    };
  }

  function normalizeThemePacks(themePacks, fallbackConfig) {
    const fallbackThemePacks = Array.isArray(fallbackConfig.themePacks) ? fallbackConfig.themePacks : [];
    const storedThemePacks = Array.isArray(themePacks)
      ? themePacks.map((pack) => ({
          ...pack,
          id: normalizeThemePackId(pack?.id),
        }))
      : [];
    const storedById = new Map(storedThemePacks.filter((pack) => pack?.id).map((pack) => [pack.id, pack]));
    const knownIds = new Set(fallbackThemePacks.map((pack) => pack.id));
    const merged = fallbackThemePacks.map((pack) => mergeThemePackWithFallback(pack, storedById.get(pack.id)));
    return merged.concat(storedThemePacks.filter((pack) => pack?.id && !knownIds.has(pack.id)).map((pack) => ({
      ...pack,
      kind: pack.kind || "custom",
    })));
  }

  function normalizeConfig(value, fallbackConfig) {
    const fallback = fallbackConfig || window.CursorDanceDefaultConfig || {};
    const rawThemePacks = Array.isArray(value?.themePacks) ? value.themePacks : value?.schemes;
    const themePacks = normalizeThemePacks(rawThemePacks, fallback);
    const fallbackThemePackId = fallback.activeThemePackId || fallback.activeSchemeId || themePacks[0]?.id;
    const rawActiveThemePackId = normalizeThemePackId(value?.activeThemePackId || value?.activeSchemeId);
    const activeThemePackId = themePacks.some((pack) => pack.id === rawActiveThemePackId) ? rawActiveThemePackId : fallbackThemePackId;
    const siteRules = normalizeSiteRules(value?.siteRules, fallback.siteRules);

    return {
      ...fallback,
      ...value,
      schemaVersion: 2,
      enabled: value?.enabled !== false,
      activeThemePackId,
      activeSchemeId: activeThemePackId,
      themePacks,
      schemes: themePacks,
      siteRules,
      performance: {
        ...(fallback.performance || {}),
        ...(value?.performance || {}),
      },
      editor: normalizeEditorPrefs(value?.editor, fallback.editor),
    };
  }

  function needsMigration(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return true;
    if (value.schemaVersion !== 2) return true;
    if (!Array.isArray(value.themePacks)) return true;
    if (!value.activeThemePackId) return true;
    return Object.values(value.siteRules?.byHost || {}).some((rule) => typeof rule === "string");
  }

  function getSiteRule(config, host) {
    return normalizeSiteRule(config?.siteRules?.byHost?.[host]);
  }

  function getSiteMode(config, host) {
    return getSiteRule(config, host).mode;
  }

  function setSiteRuleMode(config, host, mode) {
    const nextByHost = {
      ...(config?.siteRules?.byHost || {}),
    };
    if (!host || mode === "inherit") {
      delete nextByHost[host];
    } else {
      const currentRule = normalizeSiteRule(nextByHost[host]);
      nextByHost[host] = {
        ...currentRule,
        mode,
      };
    }
    return {
      ...config,
      siteRules: {
        ...(config?.siteRules || {}),
        byHost: nextByHost,
      },
    };
  }

  const defaultThemePacks = createDefaultThemePacks();
  const defaultConfig = {
    schemaVersion: 2,
    enabled: true,
    activeThemePackId: "woodfish",
    activeSchemeId: "woodfish",
    themePacks: defaultThemePacks,
    schemes: defaultThemePacks,
    performance: {
      maxActiveEffects: 48,
    },
    siteRules: {
      byHost: {},
    },
    editor: {
      mode: "simple",
      lastWorkspace: "workspace",
      lastActionId: "leftClick",
      lastCursorState: "default",
    },
  };

  window.CursorDanceDefaultConfig = defaultConfig;
  window.CursorDanceConfigRuntime = {
    cloneValue,
    createDefaultThemePacks,
    createDefaultCursorStates,
    inferTextKindFromEffect,
    resolveNumberStyleFromEffect,
    resolveTextModeFromEffect,
    resolveActionTextConfigFromEffect,
    buildStoredTextEffectPayload,
    mergeThemePackWithFallback,
    mergeCursorStates,
    normalizeSiteRule,
    normalizeSiteRules,
    normalizeConfig,
    needsMigration,
    getSiteRule,
    getSiteMode,
    setSiteRuleMode,
  };
})();
