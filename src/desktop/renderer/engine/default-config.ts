// CursorDance 默认配置 + 主题工厂
//
// 从 extension/config.js 迁移而来（任务 2.5）。关键调整：
//   - 去 IIFE / globalThis.CursorDanceDefaultConfig，改为 ES module 导出。
//   - 内置 4 套主题包（mono-geo / drift / molten / sunset）的 leftClick
//     默认配置 **字节级保留**，与扩展端 cursor 颜色 / 粒子 / 涟漪一一对应。
//   - normalizeSiteRules 保留——桌面端虽然把 site → app，但 schema v3
//     仍承载 siteRules 字段做向后兼容；新的 appRules 走独立路径
//     （另见 app-matcher.ts 与任务 3.x 的存储适配）。
//   - 不引用 chrome.*、不挂 window.*。
//
// 任务 2.9：补全桌面端 5 个 action 的内置默认配置。
//   - 桌面 5 action：leftClick / rightClick / doubleClick / longPress / wheel（无 hover）。
//   - 此前只有 leftClick 有内置主题包配置，其它 4 个 action 在 trigger-handlers
//     里走 missing-source-action-config skip 分支，overlay 不出效果。
//   - 新增配置以扩展端 actionConfigPresets.ts 的 BASE preset + THEME_ACTION_OVERRIDES
//     合并结果为蓝本，挑出引擎实际消费的字段（trigger/text/particle/ripple/audio/
//     animation/cursor），保持每套主题的配色与粒子风格一致。

export interface CursorStateConfig {
  mode: "inherit" | "override";
  actionId: string;
  imageDataUrl: string;
  hotspotX: number;
  hotspotY: number;
  size: number;
}

export type CursorSkinStateId =
  | "default"
  | "text"
  | "pointer"
  | "grab"
  | "grabbing"
  | "busy"
  | "notAllowed"
  | "crosshair"
  | "move"
  | "resizeHorizontal"
  | "resizeVertical"
  | "resizeDiagonalNWSE"
  | "resizeDiagonalNESW";

export interface CursorSkinImage {
  kind: "dataUrl";
  mimeType: "image/png" | "image/svg+xml" | "image/webp" | "image/unknown";
  dataUrl: string;
  width: number;
  height: number;
}

export interface CursorSkinState {
  image: CursorSkinImage;
  hotspot: { x: number; y: number };
  size: { mode: "source" | "fixedBox"; boxSize?: number };
}

export interface CursorSkin {
  version: 1;
  enabled: boolean;
  transitionMs: number;
  states: Partial<Record<CursorSkinStateId, CursorSkinState>>;
}

export interface ThemePack {
  id: string;
  name?: string;
  description?: string;
  kind?: "builtin" | "custom";
  cursorStates: Record<string, CursorStateConfig>;
  cursorSkin?: CursorSkin;
  workbenchDraft?: {
    actionConfigs?: Record<string, Record<string, unknown>>;
    cursorModes?: Record<string, string>;
    cursorStateActions?: Record<string, string>;
    cursorStateAssets?: Record<string, unknown>;
    cursorSkin?: CursorSkin;
    keyFeedbackConfig?: Partial<KeyFeedbackConfig>;
    resetKeyFeedbackConfig?: Partial<KeyFeedbackConfig>;
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

import type { KeyFeedbackConfig } from "./key-feedback-types";
import { defaultKeyFeedbackConfig, normalizeKeyFeedbackConfig } from "./key-feedback-types";

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
  keyFeedbackConfig?: KeyFeedbackConfig;
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

export const DEFAULT_CURSOR_SKIN_STATE_IDS: CursorSkinStateId[] = [
  "default",
  "text",
  "pointer",
  "grab",
  "grabbing",
  "busy",
  "notAllowed",
  "crosshair",
  "move",
  "resizeHorizontal",
  "resizeVertical",
  "resizeDiagonalNWSE",
  "resizeDiagonalNESW",
];

export const LEGACY_CURSOR_STATE_TO_SKIN_STATE: Record<string, CursorSkinStateId> = {
  default: "default",
  pointer: "pointer",
  text: "text",
  wait: "busy",
  notAllowed: "notAllowed",
};

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

function normalizeCursorSkinImage(image: Partial<CursorSkinImage> | null | undefined): CursorSkinImage | null {
  if (!image || typeof image !== "object" || Array.isArray(image)) return null;
  if (typeof image.dataUrl !== "string" || !image.dataUrl) return null;
  const mimeType = typeof image.mimeType === "string" ? image.mimeType : "image/unknown";
  return {
    kind: "dataUrl",
    mimeType: ["image/png", "image/svg+xml", "image/webp"].includes(mimeType) ? mimeType as CursorSkinImage["mimeType"] : "image/unknown",
    dataUrl: image.dataUrl,
    width: Number.isFinite(image.width) ? image.width as number : 48,
    height: Number.isFinite(image.height) ? image.height as number : 48,
  };
}

export function normalizeCursorSkinState(state: Partial<CursorSkinState> | null | undefined): CursorSkinState | null {
  if (!state || typeof state !== "object" || Array.isArray(state)) return null;
  const image = normalizeCursorSkinImage(state.image);
  if (!image) return null;
  const hotspot = state.hotspot && typeof state.hotspot === "object" && !Array.isArray(state.hotspot) ? state.hotspot : {};
  const size = state.size && typeof state.size === "object" && !Array.isArray(state.size) ? state.size : {};
  const boxSize = Number.isFinite(size.boxSize) ? size.boxSize as number : undefined;

  return {
    image,
    hotspot: {
      x: Number.isFinite(hotspot.x) ? hotspot.x as number : 0,
      y: Number.isFinite(hotspot.y) ? hotspot.y as number : 0,
    },
    size: size.mode === "fixedBox"
      ? { mode: "fixedBox", boxSize: boxSize ?? 48 }
      : { mode: "source" },
  };
}

function cursorSkinStateFromLegacy(state: Partial<CursorStateConfig> | null | undefined): CursorSkinState | null {
  if (!state?.imageDataUrl) return null;
  const size = Number.isFinite(state.size) ? state.size as number : 48;
  return {
    image: {
      kind: "dataUrl",
      mimeType: state.imageDataUrl.startsWith("data:image/svg+xml")
        ? "image/svg+xml"
        : state.imageDataUrl.startsWith("data:image/webp")
          ? "image/webp"
          : state.imageDataUrl.startsWith("data:image/png")
            ? "image/png"
            : "image/unknown",
      dataUrl: state.imageDataUrl,
      width: size,
      height: size,
    },
    hotspot: {
      x: Number.isFinite(state.hotspotX) ? state.hotspotX as number : 0,
      y: Number.isFinite(state.hotspotY) ? state.hotspotY as number : 0,
    },
    size: { mode: "fixedBox", boxSize: size },
  };
}

export function createDefaultCursorSkin(cursorStates?: Record<string, Partial<CursorStateConfig>> | null): CursorSkin {
  const states: Partial<Record<CursorSkinStateId, CursorSkinState>> = {};
  Object.entries(cursorStates || {}).forEach(([legacyStateId, state]) => {
    const skinStateId = LEGACY_CURSOR_STATE_TO_SKIN_STATE[legacyStateId];
    if (!skinStateId) return;
    const skinState = cursorSkinStateFromLegacy(state);
    if (skinState) states[skinStateId] = skinState;
  });
  return {
    version: 1,
    enabled: true,
    transitionMs: 80,
    states,
  };
}

export function normalizeCursorSkin(
  cursorSkin: Partial<CursorSkin> | null | undefined,
  legacyCursorStates?: Record<string, Partial<CursorStateConfig>> | null,
): CursorSkin {
  const fallback = createDefaultCursorSkin(legacyCursorStates);
  const rawStates = cursorSkin?.states && typeof cursorSkin.states === "object" && !Array.isArray(cursorSkin.states)
    ? cursorSkin.states
    : {};
  const states: Partial<Record<CursorSkinStateId, CursorSkinState>> = { ...fallback.states };

  Object.entries(rawStates).forEach(([stateId, state]) => {
    if (!DEFAULT_CURSOR_SKIN_STATE_IDS.includes(stateId as CursorSkinStateId)) return;
    const normalized = normalizeCursorSkinState(state as Partial<CursorSkinState>);
    if (normalized) states[stateId as CursorSkinStateId] = normalized;
  });

  return {
    version: 1,
    enabled: cursorSkin?.enabled !== false,
    transitionMs: Number.isFinite(cursorSkin?.transitionMs) ? cursorSkin?.transitionMs as number : fallback.transitionMs,
    states,
  };
}

import { getDefaultThemePackDefinitions } from "./data/default-theme-packs";

export function createDefaultThemePacks(): ThemePack[] {
  return getDefaultThemePackDefinitions(createDefaultCursorStates()).map((pack) => {
    const cloned = cloneValue(pack);
    return {
      ...cloned,
      cursorSkin: createDefaultCursorSkin(cloned.cursorStates),
      workbenchDraft: {
        ...(cloned.workbenchDraft || {}),
        keyFeedbackConfig: normalizeKeyFeedbackConfig(cloned.workbenchDraft?.keyFeedbackConfig),
        resetKeyFeedbackConfig: normalizeKeyFeedbackConfig(cloned.workbenchDraft?.resetKeyFeedbackConfig || cloned.workbenchDraft?.keyFeedbackConfig),
      },
    };
  });
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
    keyFeedbackConfig: normalizeKeyFeedbackConfig(
      pack?.workbenchDraft?.keyFeedbackConfig
      ?? fallbackPack.workbenchDraft?.keyFeedbackConfig,
    ),
    resetKeyFeedbackConfig: normalizeKeyFeedbackConfig(
      pack?.workbenchDraft?.resetKeyFeedbackConfig
      ?? pack?.workbenchDraft?.keyFeedbackConfig
      ?? fallbackPack.workbenchDraft?.resetKeyFeedbackConfig
      ?? fallbackPack.workbenchDraft?.keyFeedbackConfig,
    ),
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
    cursorSkin: normalizeCursorSkin(pack?.cursorSkin || pack?.workbenchDraft?.cursorSkin || fallbackPack.cursorSkin, pack?.cursorStates || fallbackPack.cursorStates),
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
  let themePacks = normalizeThemePacks(rawThemePacks, fallback);
  const fallbackThemePackId = fallback.activeThemePackId || fallback.activeSchemeId || themePacks[0]?.id;
  const rawActiveThemePackId = v.activeThemePackId || v.activeSchemeId;
  const activeThemePackId = themePacks.some((pack) => pack.id === rawActiveThemePackId) ? rawActiveThemePackId! : fallbackThemePackId!;
  const siteRules = normalizeSiteRules(v.siteRules, fallback.siteRules);
  const legacyKeyFeedbackConfig = v.keyFeedbackConfig;
  const rawThemePackById = new Map(Array.isArray(rawThemePacks) ? rawThemePacks.map((pack) => [pack?.id, pack]) : []);
  if (v.keyFeedbackConfig) {
    themePacks = themePacks.map((pack) => {
      const rawThemePack = rawThemePackById.get(pack.id);
      if (rawThemePack?.workbenchDraft?.keyFeedbackConfig) return pack;
      const migratedKeyFeedbackConfig = normalizeKeyFeedbackConfig(v.keyFeedbackConfig);
      return {
        ...pack,
        workbenchDraft: {
          ...(pack.workbenchDraft || {}),
          keyFeedbackConfig: migratedKeyFeedbackConfig,
          resetKeyFeedbackConfig: migratedKeyFeedbackConfig,
        },
      };
    });
  }
  const normalizedConfig: CursorDanceConfig = {
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

  if (legacyKeyFeedbackConfig) {
    normalizedConfig.keyFeedbackConfig = normalizeKeyFeedbackConfig(legacyKeyFeedbackConfig as Partial<KeyFeedbackConfig>);
  } else {
    delete normalizedConfig.keyFeedbackConfig;
  }

  return normalizedConfig;
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
  keyFeedbackConfig: { ...defaultKeyFeedbackConfig },
};
