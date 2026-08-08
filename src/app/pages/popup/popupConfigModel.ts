import type { ContextRuleAction } from "@/shared/domain/cursor-dance";
import { findWebContextRule, resolveWebContextRule } from "@/shared/web-context-rules";
import type { WorkbenchEditorState } from "../theme-workbench/lib/storage/repository/types";
import type { WorkbenchTheme } from "../theme-workbench/hooks/workbenchStateTypes";
import { ACTIONS } from "../theme-workbench/model/workbenchSchema";
import type { CursorDanceConfig } from "@/shared/domain/cursor-dance";

export interface PopupSiteContext {
  host: string;
  path: string;
  isSupportedPage: boolean;
  isPreviewMode: boolean;
  tabId: number | null;
}

export interface PopupNotice {
  tone: "slate" | "amber" | "rose";
  message: string;
}

export function getPreviewActionId(editorState: WorkbenchEditorState | null): string {
  return ACTIONS.some((item) => item.id === editorState?.actionId)
    ? editorState?.actionId || "leftClick"
    : "leftClick";
}

export function getActionConfig(
  theme: WorkbenchTheme,
  actionId: string,
): Record<string, unknown> | null {
  return theme.draft.actionConfigs?.[actionId]
    ?? theme.draft.actionConfigs?.leftClick
    ?? null;
}

export function buildInitialNotice(site: PopupSiteContext): PopupNotice {
  if (site.isPreviewMode) {
    return { tone: "slate", message: "本地预览模式已就绪。" };
  }
  if (site.isSupportedPage) {
    return { tone: "slate", message: "已连接当前网页。" };
  }
  return { tone: "amber", message: "当前标签页不是普通网页，部分操作暂不可用。" };
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function getSiteAction(
  config: CursorDanceConfig | null,
  host: string,
  path: string,
): ContextRuleAction | null {
  return resolveWebContextRule(config?.contextRules, host, path, config?.enabled);
}

export function getEffectiveActiveThemeId(
  siteAction: ContextRuleAction | null,
  activeThemeId: string,
): string {
  return siteAction?.type === "enable" && siteAction.themeId
    ? siteAction.themeId
    : activeThemeId;
}

export function resolveNextConfigForThemeChange(
  currentConfig: CursorDanceConfig,
  site: PopupSiteContext,
  themeId: string,
): CursorDanceConfig {
  const rules = Array.isArray(currentConfig.contextRules) ? currentConfig.contextRules : [];
  const matchedRule = findWebContextRule(rules, site.host, site.path);
  const matchedIndex = matchedRule ? rules.indexOf(matchedRule) : -1;

  if (matchedIndex >= 0 && site.host) {
    const nextRules = rules.slice();
    nextRules[matchedIndex] = { ...matchedRule, action: { type: "enable", themeId } };
    return { ...currentConfig, contextRules: nextRules };
  }

  return { ...currentConfig, activeThemeId: themeId };
}
