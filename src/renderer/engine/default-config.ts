// CursorDance 默认配置 + 主题工厂
//
// 从 public/config.js 迁移而来（任务 2.5）。关键调整：
//   - 去 IIFE / globalThis.CursorDanceDefaultConfig，改为 ES module 导出。
//   - 内置 4 套主题包（mono-geo / drift / molten / sunset）的 leftClick
//     默认配置 **字节级保留**，与扩展端 cursor 颜色 / 粒子 / 涟漪一一对应。
//   - normalizeSiteRules 保留——桌面端虽然把 site → app，但 schema v3
//     仍承载 siteRules 字段做向后兼容；新的 appRules 走独立路径
//     （另见 app-matcher.ts 与任务 3.x 的存储适配）。
//   - 不引用 chrome.*、不挂 window.*。

export interface CursorStateConfig {
  mode: "inherit" | "override";
  actionId: string;
  imageDataUrl: string;
  hotspotX: number;
  hotspotY: number;
  size: number;
}

export interface ThemePack {
  id: string;
  name?: string;
  description?: string;
  kind?: "builtin" | "custom";
  cursorStates: Record<string, CursorStateConfig>;
  workbenchDraft?: {
    actionConfigs?: Record<string, Record<string, unknown>>;
    cursorModes?: Record<string, string>;
    cursorStateActions?: Record<string, string>;
    cursorStateAssets?: Record<string, unknown>;
    atmosphere?: { mode?: string };
  };
}

export interface SiteRule {
  id: string;
  pattern: { type: string; value: string };
  action: "disable" | { enable: boolean; theme?: string };
  enabled: boolean;
}

export interface EditorPrefs {
  mode: "simple" | "advanced";
  lastWorkspace: string;
  lastActionId: string;
  lastCursorState: string;
}

export interface CursorDanceConfig {
  schemaVersion: number;
  enabled: boolean;
  activeThemePackId: string;
  activeSchemeId: string;
  themePacks: ThemePack[];
  schemes: ThemePack[];
  performance: { maxActiveEffects: number };
  siteRules: SiteRule[];
  editor: EditorPrefs;
}

export function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export const DEFAULT_CURSOR_STATE_IDS = [
  "default",
  "pointer",
  "text",
  "help",
  "wait",
  "notAllowed",
];

export function createDefaultCursorStates(): Record<string, CursorStateConfig> {
  return DEFAULT_CURSOR_STATE_IDS.reduce<Record<string, CursorStateConfig>>((states, stateId) => {
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

export function normalizeCursorStateConfig(
  stateConfig: Partial<CursorStateConfig> | null | undefined,
  fallbackStateConfig: Partial<CursorStateConfig> | null | undefined,
): CursorStateConfig {
  return {
    ...(fallbackStateConfig as CursorStateConfig || {}),
    ...((stateConfig && typeof stateConfig === "object" && !Array.isArray(stateConfig)) ? stateConfig : {}),
    mode: stateConfig?.mode === "override" ? "override" : (fallbackStateConfig?.mode || "inherit"),
    actionId: typeof stateConfig?.actionId === "string" ? stateConfig.actionId : (fallbackStateConfig?.actionId || "leftClick"),
    imageDataUrl: typeof stateConfig?.imageDataUrl === "string" ? stateConfig.imageDataUrl : (fallbackStateConfig?.imageDataUrl || ""),
    hotspotX: Number.isFinite(stateConfig?.hotspotX) ? (stateConfig?.hotspotX as number) : (fallbackStateConfig?.hotspotX ?? 16),
    hotspotY: Number.isFinite(stateConfig?.hotspotY) ? (stateConfig?.hotspotY as number) : (fallbackStateConfig?.hotspotY ?? 32),
    size: Number.isFinite(stateConfig?.size) ? (stateConfig?.size as number) : (fallbackStateConfig?.size ?? 48),
  };
}

export function mergeCursorStates(
  fallbackCursorStates: Record<string, CursorStateConfig> | null | undefined,
  cursorStates: Record<string, Partial<CursorStateConfig>> | null | undefined,
): Record<string, CursorStateConfig> {
  const fallback = fallbackCursorStates || createDefaultCursorStates();
  const nextStates: Record<string, CursorStateConfig> = { ...fallback };

  DEFAULT_CURSOR_STATE_IDS.forEach((stateId) => {
    nextStates[stateId] = normalizeCursorStateConfig(cursorStates?.[stateId], fallback[stateId]);
  });

  Object.entries(cursorStates || {}).forEach(([stateId, stateConfig]) => {
    if (Object.prototype.hasOwnProperty.call(nextStates, stateId)) return;
    nextStates[stateId] = normalizeCursorStateConfig(stateConfig, { mode: "inherit" });
  });

  return nextStates;
}

const defaultThemePackDefinitions: ThemePack[] = [
  {
    id: "mono-geo",
    name: "几何",
    description: "黑白灰配色、方块粒子和几何波纹，极简克制的反馈风格。",
    kind: "builtin",
    cursorStates: createDefaultCursorStates(),
    workbenchDraft: {
      actionConfigs: {
        leftClick: {
          textEnabled: true,
          textKind: "数字飘字",
          textContent: "+1",
          textTags: ["+1", "+2", "+3"],
          textColor: "#1E293B",
          fontSize: 20,
          textWeight: "中等",
          textEasing: "线性",
          textShadow: "无",
          textFontFamily: "等宽字体",
          textOffsetY: -24,
          textDuration: 860,
          comboEnabled: true,
          ripple: true,
          rippleSize: 48,
          rippleDuration: 540,
          rippleStyle: "单环",
          rippleColor: "#334155",
          rippleOpacity: 42,
          particle: true,
          particleCount: 18,
          particleSize: 12,
          particleSpread: 56,
          particleStyle: "方块",
          particleDuration: 640,
          particleGravity: 4,
          particleBounce: 8,
          particleOpacity: 82,
          particlePalette: ["#1E293B", "#334155", "#475569", "#64748B", "#94A3B8"],
          particleColorMode: "随机轻变化",
          sound: false,
          shake: 14,
          cursorOverride: "跟随当前状态",
          holdMs: 0,
        },
      },
    },
  },
  {
    id: "drift",
    name: "流光",
    description: "轨道粒子环绕光标、涟漪扩散，沉静青绿调，适合专注工作场景。",
    kind: "builtin",
    cursorStates: createDefaultCursorStates(),
    workbenchDraft: {
      actionConfigs: {
        leftClick: {
          textEnabled: false,
          ripple: true,
          rippleSize: 44,
          rippleDuration: 680,
          rippleStyle: "柔和面波",
          rippleColor: "#14B8A6",
          rippleOpacity: 28,
          particle: true,
          particleCount: 16,
          particleSize: 10,
          particleSpread: 60,
          particleStyle: "点状粒子",
          particleMotionMode: "orbital",
          orbitalCount: 8,
          orbitalRadius: 28,
          orbitalSpeed: 2,
          particleDuration: 900,
          particleOpacity: 80,
          particleColorMode: "随机轻变化",
          particlePalette: ["#0D9488", "#14B8A6", "#5EEAD4", "#99F6E4"],
          cursorTrailEnabled: true,
          cursorTrailCount: 3,
          cursorTrailOpacity: 28,
          cursorGlowColor: "#14B8A6",
          sound: false,
          shake: 0,
          cursorOverride: "跟随当前状态",
          holdMs: 0,
        },
      },
    },
  },
  {
    id: "molten",
    name: "熔金",
    description: "火花向上喷发如熔岩飞溅、能量脉冲涟漪，温暖有力的橙金调。",
    kind: "builtin",
    cursorStates: createDefaultCursorStates(),
    workbenchDraft: {
      actionConfigs: {
        leftClick: {
          textEnabled: true,
          textContent: "+1",
          textTags: ["+1", "+2", "+3"],
          textColor: "#EA580C",
          fontSize: 22,
          textWeight: "加粗",
          textEasing: "弹性",
          textShadow: "清晰",
          textGradient: true,
          textGradientStart: "#F97316",
          textGradientEnd: "#FBBF24",
          textOffsetY: -28,
          textDuration: 920,
          comboEnabled: true,
          ripple: true,
          rippleSize: 60,
          rippleDuration: 760,
          rippleStyle: "能量脉冲",
          rippleColor: "#F97316",
          rippleOpacity: 60,
          particle: true,
          particleCount: 28,
          particleSize: 14,
          particleSpread: 60,
          particleStyle: "火花",
          particleDirection: "向上喷发",
          particleDuration: 820,
          particleGravity: 12,
          particleBounce: 6,
          particleOpacity: 90,
          particleColorMode: "随机轻变化",
          particlePalette: ["#F97316", "#FB923C", "#FBBF24", "#FEF08A", "#FDE68A"],
          cursorTrailEnabled: true,
          cursorTrailCount: 4,
          cursorTrailOpacity: 40,
          cursorGlowColor: "#F97316",
          sound: true,
          volume: 56,
          shake: 32,
          cursorOverride: "跟随当前状态",
          holdMs: 0,
        },
      },
    },
  },
  {
    id: "sunset",
    name: "夕霞",
    description: "钻石粒子缓缓飘落、回声涟漪荡漾，落日粉橙暖调，温柔优雅。",
    kind: "builtin",
    cursorStates: createDefaultCursorStates(),
    workbenchDraft: {
      actionConfigs: {
        leftClick: {
          textEnabled: true,
          textContent: "+1",
          textTags: ["+1", "+2", "+3"],
          textColor: "#BE185D",
          fontSize: 20,
          textWeight: "加粗",
          textEasing: "弹跳",
          textShadow: "柔和",
          textGradient: true,
          textGradientStart: "#F43F5E",
          textGradientEnd: "#FB923C",
          textOffsetY: -26,
          textDuration: 900,
          comboEnabled: true,
          ripple: true,
          rippleSize: 52,
          rippleDuration: 720,
          rippleStyle: "回声环",
          rippleColor: "#FB7185",
          rippleOpacity: 44,
          particle: true,
          particleCount: 20,
          particleSize: 12,
          particleSpread: 64,
          particleStyle: "钻石",
          particleDuration: 780,
          particleGravity: 4,
          particleWind: 2,
          particleBounce: 8,
          particleOpacity: 82,
          particleColorMode: "随机轻变化",
          particlePalette: ["#F43F5E", "#FB7185", "#FDA4AF", "#FBCFE8", "#FFF1F2"],
          cursorTrailEnabled: true,
          cursorTrailCount: 3,
          cursorTrailOpacity: 32,
          cursorGlowColor: "#FB7185",
          sound: false,
          shake: 0,
          cursorOverride: "跟随当前状态",
          holdMs: 0,
        },
      },
    },
  },
];

export function createDefaultThemePacks(): ThemePack[] {
  return defaultThemePackDefinitions.map((pack) => cloneValue(pack));
}

export function mergeThemePackWithFallback(
  fallbackPack: ThemePack,
  pack: Partial<ThemePack> | undefined,
): ThemePack {
  const normalizedId = pack?.id || fallbackPack?.id;
  const mergedWorkbenchDraft = {
    ...(fallbackPack.workbenchDraft || {}),
    ...(pack?.workbenchDraft || {}),
    actionConfigs: {
      ...(fallbackPack.workbenchDraft?.actionConfigs || {}),
      ...(pack?.workbenchDraft?.actionConfigs || {}),
    },
  };
  Object.keys(mergedWorkbenchDraft.actionConfigs).forEach((actionId) => {
    mergedWorkbenchDraft.actionConfigs[actionId] = {
      ...(fallbackPack.workbenchDraft?.actionConfigs?.[actionId] || {}),
      ...(pack?.workbenchDraft?.actionConfigs?.[actionId] || {}),
    };
  });
  return {
    ...fallbackPack,
    ...pack,
    id: normalizedId,
    kind: pack?.kind || fallbackPack.kind || "custom",
    cursorStates: mergeCursorStates(fallbackPack.cursorStates, pack?.cursorStates as Record<string, Partial<CursorStateConfig>>),
    workbenchDraft: mergedWorkbenchDraft,
  };
}

export function normalizeSiteRules(
  siteRules: unknown,
  fallbackSiteRules: SiteRule[] | undefined,
): SiteRule[] {
  if (Array.isArray(siteRules)) {
    return siteRules
      .filter((rule): rule is { pattern: { type?: string; value?: unknown }; action: SiteRule["action"]; id?: string; enabled?: boolean } =>
        Boolean(rule && typeof rule === "object" && rule.pattern && rule.action))
      .map((rule, index) => ({
        id: rule.id || ("r" + (index + 1)),
        pattern: {
          type: (rule.pattern && rule.pattern.type) || "exact",
          value: (rule.pattern && typeof rule.pattern.value === "string") ? rule.pattern.value : "",
        },
        action: rule.action,
        enabled: rule.enabled !== false,
      }));
  }

  if (Array.isArray(fallbackSiteRules)) return fallbackSiteRules;
  return [];
}

export function normalizeEditorPrefs(
  editorPrefs: Partial<EditorPrefs> | null | undefined,
  fallbackEditorPrefs: Partial<EditorPrefs> | null | undefined,
): EditorPrefs {
  return {
    mode: editorPrefs?.mode === "advanced" ? "advanced" : (fallbackEditorPrefs?.mode || "simple"),
    lastWorkspace: editorPrefs?.lastWorkspace || fallbackEditorPrefs?.lastWorkspace || "workspace",
    lastActionId: editorPrefs?.lastActionId || fallbackEditorPrefs?.lastActionId || "leftClick",
    lastCursorState: editorPrefs?.lastCursorState || fallbackEditorPrefs?.lastCursorState || "default",
  };
}

export function normalizeThemePacks(
  themePacks: unknown,
  fallbackConfig: { themePacks?: ThemePack[] },
): ThemePack[] {
  const fallbackThemePacks = Array.isArray(fallbackConfig.themePacks) ? fallbackConfig.themePacks : [];
  const storedThemePacks: Partial<ThemePack>[] = Array.isArray(themePacks)
    ? (themePacks as Partial<ThemePack>[]).map((pack) => ({
        ...pack,
        id: pack?.id,
      }))
    : [];
  const storedById = new Map(storedThemePacks.filter((pack): pack is Partial<ThemePack> & { id: string } => Boolean(pack?.id)).map((pack) => [pack.id, pack]));
  const knownIds = new Set(fallbackThemePacks.map((pack) => pack.id));
  const merged = fallbackThemePacks.map((pack) => mergeThemePackWithFallback(pack, storedById.get(pack.id)));
  return merged.concat(
    storedThemePacks
      .filter((pack): pack is Partial<ThemePack> & { id: string } => Boolean(pack?.id) && !knownIds.has(pack.id as string))
      .map((pack) => ({
        ...pack,
        kind: pack.kind || "custom",
      } as ThemePack)),
  );
}

export function normalizeConfig(
  value: Partial<CursorDanceConfig> | { schemes?: ThemePack[]; activeSchemeId?: string } | null | undefined,
  fallbackConfig?: CursorDanceConfig,
): CursorDanceConfig {
  const fallback = fallbackConfig || defaultConfig;
  const v = (value || {}) as Partial<CursorDanceConfig> & { schemes?: ThemePack[]; activeSchemeId?: string };
  const rawThemePacks = Array.isArray(v.themePacks) ? v.themePacks : v.schemes;
  const themePacks = normalizeThemePacks(rawThemePacks, fallback);
  const fallbackThemePackId = fallback.activeThemePackId || fallback.activeSchemeId || themePacks[0]?.id;
  const rawActiveThemePackId = v.activeThemePackId || v.activeSchemeId;
  const activeThemePackId = themePacks.some((pack) => pack.id === rawActiveThemePackId) ? rawActiveThemePackId! : fallbackThemePackId!;
  const siteRules = normalizeSiteRules(v.siteRules, fallback.siteRules);

  return {
    ...fallback,
    ...v,
    schemaVersion: 3,
    enabled: v.enabled !== false,
    activeThemePackId,
    activeSchemeId: activeThemePackId,
    themePacks,
    schemes: themePacks,
    siteRules,
    performance: {
      ...(fallback.performance || { maxActiveEffects: 48 }),
      ...(v.performance || {}),
    },
    editor: normalizeEditorPrefs(v.editor, fallback.editor),
  };
}

export function needsMigration(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return true;
  const v = value as Partial<CursorDanceConfig>;
  if (v.schemaVersion !== 3) return true;
  if (!Array.isArray(v.themePacks)) return true;
  if (!v.activeThemePackId) return true;
  if (v.siteRules && !Array.isArray(v.siteRules)) return true;
  return false;
}

const defaultThemePacks = createDefaultThemePacks();

export const defaultConfig: CursorDanceConfig = {
  schemaVersion: 3,
  enabled: true,
  activeThemePackId: "mono-geo",
  activeSchemeId: "mono-geo",
  themePacks: defaultThemePacks,
  schemes: defaultThemePacks,
  performance: {
    maxActiveEffects: 48,
  },
  siteRules: [],
  editor: {
    mode: "simple",
    lastWorkspace: "workspace",
    lastActionId: "leftClick",
    lastCursorState: "default",
  },
};
