import type {
  ContextRuleAction,
  CursorDanceConfig,
  CursorDanceTheme,
  CursorSkinState,
} from "../domain/cursor-dance";
import { getDefaultActionConfigs } from "../effect-core/default-action-configs";
import type { CursorStateId } from "../cursor-states";

type ActionConfig = Record<string, unknown>;

interface RuntimeConfigDiagnostics {
  log(scope: string, payload?: Record<string, unknown>): void;
  describeTarget?(target: unknown): unknown;
}

interface RuntimeConfigCoreOptions {
  window: Window;
  getConfig(): CursorDanceConfig;
  resolveContextAction(): ContextRuleAction | null;
  interactiveSelector: string;
  textEditableSelector: string;
  diagnostics?: RuntimeConfigDiagnostics;
}

const defaultActionConfigsByThemeId = new Map<string | null, Record<string, ActionConfig>>();

function getCachedDefaultActionConfigs(themeId: string | null): Record<string, ActionConfig> {
  let configs = defaultActionConfigsByThemeId.get(themeId);
  if (!configs) {
    configs = getDefaultActionConfigs(themeId) as Record<string, ActionConfig>;
    defaultActionConfigsByThemeId.set(themeId, configs);
  }
  return configs;
}

function mergeActionConfig(base: ActionConfig, overlay: ActionConfig): ActionConfig {
  const safeOverlay = Object.fromEntries(
    Object.entries(overlay).filter(([, value]) => value !== undefined),
  );
  return {
    ...base,
    ...safeOverlay,
    textTags: Array.isArray(overlay.textTags)
      ? [...overlay.textTags]
      : (Array.isArray(base.textTags) ? [...base.textTags] : []),
  };
}

export function createRuntimeConfigCore(options: RuntimeConfigCoreOptions) {
  const {
    window,
    getConfig,
    resolveContextAction,
    interactiveSelector,
    textEditableSelector,
    diagnostics,
  } = options;
  const ElementCtor = (window as Window & { Element?: typeof Element }).Element
    ?? (typeof Element === "undefined" ? undefined : Element);
  const cursorStateIdCache: { target: Element | null; stateId: CursorStateId } = {
    target: null,
    stateId: "default",
  };

  function asElement(target: unknown): Element | null {
    return ElementCtor && target instanceof ElementCtor ? target : null;
  }

  function getActiveTheme(): CursorDanceTheme {
    const config = getConfig();
    const action = resolveContextAction();
    const themeId = action?.type === "enable" ? action.themeId : undefined;
    return config.themes.find((theme) => theme.id === (themeId || config.activeThemeId))
      ?? config.themes[0];
  }

  function isCurrentContextEnabled(): boolean {
    const action = resolveContextAction();
    if (action?.type === "disable") return false;
    if (action?.type === "enable") return true;
    return getConfig().enabled;
  }

  function getMaxActiveEffects(): number {
    return getConfig().performance.maxActiveEffects || 48;
  }

  function getActionConfig(
    theme: CursorDanceTheme | null | undefined,
    actionId: string,
  ): ActionConfig | null {
    if (!theme) return null;
    const defaults = getCachedDefaultActionConfigs(theme.id || null);
    const base = defaults[actionId] ?? defaults.leftClick;
    const stored = theme.actionConfigs[actionId] as ActionConfig | undefined;
    if (!stored) return base ?? null;
    return mergeActionConfig(base ?? {}, stored);
  }

  function getCursorStateBinding(
    theme: CursorDanceTheme | null | undefined,
    stateId: string,
    sourceActionId: string,
  ): { cursorStateId: string; actionId: string; inheritedFromDefault: boolean } {
    if (sourceActionId !== "leftClick") {
      return { cursorStateId: stateId, actionId: sourceActionId, inheritedFromDefault: false };
    }
    const defaultBinding = theme?.cursorBindings.default;
    const stateBinding = theme?.cursorBindings[stateId];
    const defaultActionId = defaultBinding?.actionId || "leftClick";
    const inheritedFromDefault = stateId !== "default" && stateBinding?.mode !== "override";
    const actionId = inheritedFromDefault
      ? defaultActionId
      : (stateBinding?.actionId || defaultActionId || sourceActionId);
    return { cursorStateId: stateId, actionId, inheritedFromDefault };
  }

  function getEffectiveCursorStateConfig(
    theme: CursorDanceTheme | null | undefined,
    stateId: string,
  ): CursorSkinState | null {
    return theme?.cursorSkin.states[stateId] ?? theme?.cursorSkin.states.default ?? null;
  }

  function resolveCursorStateId(target: unknown): CursorStateId {
    const element = asElement(target);
    if (!element) return "default";
    if (element === cursorStateIdCache.target) return cursorStateIdCache.stateId;

    const cursor = window.getComputedStyle(element).cursor || "";
    // 归并说明：grab / grabbing / move / crosshair / *-resize 在 web 上都收敛到
    // pointer，因为它们没有独立的配置槽位（见 src/shared/cursor-states.ts）。
    let stateId: CursorStateId = "default";
    if (
      [
        "pointer",
        "grab",
        "grabbing",
        "move",
        "copy",
        "alias",
        "cell",
        "all-scroll",
        "crosshair",
        "context-menu",
        "zoom-in",
        "zoom-out",
      ].includes(cursor) || cursor.endsWith("-resize")
    ) stateId = "pointer";
    else if (cursor === "text" || cursor === "vertical-text") stateId = "text";
    else if (cursor === "help") stateId = "help";
    // 产出 `busy` 而非 `wait`：配置槽位的 id 是 busy，此前两者不一致导致该状态永不生效。
    else if (cursor === "wait" || cursor === "progress") stateId = "busy";
    else if (cursor === "not-allowed" || cursor === "no-drop") stateId = "notAllowed";
    else if (cursor === "none") stateId = "default";
    else if (element.closest(textEditableSelector)) stateId = "text";
    else if (element.closest(":disabled,[aria-disabled='true']")) stateId = "notAllowed";
    else if (element.closest(interactiveSelector)) stateId = "pointer";

    cursorStateIdCache.target = element;
    cursorStateIdCache.stateId = stateId;
    return stateId;
  }

  function matchesTriggerZone(
    target: unknown,
    triggerZone: unknown,
    event: unknown,
    meta: { actionId?: unknown; triggerSource?: unknown } = {},
  ): boolean {
    const zone = typeof triggerZone === "string" ? triggerZone : "";
    const element = asElement(target);
    const pointerEvent = event as {
      pointerType?: string;
      deltaY?: number;
      x?: number;
      y?: number;
    } | null;
    const isInteractive = Boolean(element?.closest(interactiveSelector));
    const x = Number(pointerEvent?.x);
    const y = Number(pointerEvent?.y);
    const viewportWidth = Number(window.innerWidth);
    const viewportHeight = Number(window.innerHeight);
    const hasScreenPoint = Number.isFinite(x)
      && Number.isFinite(y)
      && viewportWidth > 0
      && viewportHeight > 0;
    const edgeSize = Math.min(96, Math.max(40, Math.min(viewportWidth, viewportHeight) * 0.1));
    let matched = true;

    if (zone.includes("中心区域")) {
      matched = !hasScreenPoint || (
        x >= viewportWidth * 0.25
        && x <= viewportWidth * 0.75
        && y >= viewportHeight * 0.25
        && y <= viewportHeight * 0.75
      );
    } else if (zone.includes("屏幕边缘")) {
      matched = !hasScreenPoint || (
        x <= edgeSize
        || x >= viewportWidth - edgeSize
        || y <= edgeSize
        || y >= viewportHeight - edgeSize
      );
    } else if (zone.includes("按钮和链接")) matched = element ? Boolean(element.closest("a,button,[role='button']")) : true;
    else if (zone.includes("可交互元素")) matched = element ? isInteractive : true;
    else if (zone.includes("空白区域")) matched = element ? !isInteractive : true;
    else if (zone.includes("内容卡片")) matched = element ? Boolean(element.closest("article,section,li,div")) : true;
    else if (zone.includes("仅向上滚动")) matched = Number(pointerEvent?.deltaY) < 0;
    else if (zone.includes("仅向下滚动")) matched = Number(pointerEvent?.deltaY) > 0;

    diagnostics?.log("trigger-zone.check", {
      actionId: meta.actionId || null,
      triggerSource: meta.triggerSource || null,
      triggerZone: zone || "任意区域",
      matched,
      pointerType: pointerEvent?.pointerType || null,
      deltaY: Number.isFinite(pointerEvent?.deltaY) ? pointerEvent?.deltaY : null,
      x: Number.isFinite(pointerEvent?.x) ? pointerEvent?.x : null,
      y: Number.isFinite(pointerEvent?.y) ? pointerEvent?.y : null,
      target: diagnostics.describeTarget?.(target) ?? null,
    });
    return matched;
  }

  return {
    getActiveTheme,
    isCurrentContextEnabled,
    getMaxActiveEffects,
    getActionConfig,
    getCursorStateBinding,
    getEffectiveCursorStateConfig,
    resolveCursorStateId,
    matchesTriggerZone,
  };
}
