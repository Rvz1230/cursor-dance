/** @platform shared — stable application-domain names for the latest CursorDance model. */

import type {
  ContextRuleActionV4,
  ContextRuleV4,
  CursorBindingV4,
  CursorDanceConfigV4,
  CursorDanceThemeV4,
  CursorSkinStateV4,
  CursorSkinV4,
  KeyFeedbackConfigV4,
  WebContextRuleV4,
} from "../config-schema-v4";

export type CursorDanceConfig = CursorDanceConfigV4;
export type CursorDanceTheme = CursorDanceThemeV4;
export type CursorBinding = CursorBindingV4;
export type CursorSkin = CursorSkinV4;
export type CursorSkinState = CursorSkinStateV4;
export type CursorImageMimeType = CursorSkinState["image"]["mimeType"];
export type KeyFeedbackConfig = KeyFeedbackConfigV4;
export type ContextRule = ContextRuleV4;
export type ContextRuleAction = ContextRuleActionV4;
export type WebContextRule = WebContextRuleV4;
export type DesktopContextRule = Extract<ContextRule, { context: "desktop" }>;

/** One factory for every renderer and editor that needs a fresh binding map. */
export function createCursorBindings(stateIds: readonly string[]): Record<string, CursorBinding> {
  return Object.fromEntries(stateIds.map((stateId) => [stateId, {
    mode: stateId === "default" ? "override" : "inherit",
    actionId: "leftClick",
  }]));
}

/** One factory for the only supported cursor-skin shape. */
export function createCursorSkin(): CursorSkin {
  return {
    version: 1,
    enabled: true,
    transitionMs: 80,
    states: {},
  };
}
