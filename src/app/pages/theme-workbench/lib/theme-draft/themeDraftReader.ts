import type { CursorSkin } from "@/shared/domain/cursor-dance";
import { normalizeKeyFeedbackConfig } from "@/shared/config/key-feedback";
import { isDesktop } from "@/shared/runtime";
import {
  isDesktopAssetId,
  toDesktopAssetUrl,
} from "@/shared/asset-reference";
import type {
  ThemeLibraryItem,
  WorkbenchState,
  WorkbenchThemeDraft,
} from "../../hooks/workbenchStateTypes";
import {
  PLATFORM_ACTIONS,
  CURSOR_STATES,
  THEMES,
  buildThemeDrafts,
  buildThemeLibraryItem,
  createThemeDraft,
  mergeActionConfig,
} from "../../model/workbenchSchema";
import { normalizeStoredConfig } from "../runtimeConfig";
import { contextRulesToWorkbench } from "./contextRuleAdapter";

interface ThemeInput {
  id?: string;
  actionConfigs?: Readonly<Record<string, Record<string, unknown>>>;
  cursorBindings?: Readonly<Record<string, { mode?: string; actionId?: string }>>;
  cursorSkin?: CursorSkin;
  keyFeedbackConfig?: unknown;
  atmosphere?: Record<string, unknown>;
}

type WorkbenchSiteInput = Pick<WorkbenchState["site"], "host"> & Partial<WorkbenchState["site"]>;
type HydratedWorkbenchState = Pick<
  WorkbenchState,
  "workspaceId" | "selection" | "siteRules" | "appRules" | "themeLibrary" | "site" | "draftsByTheme"
> & {
  ui: Pick<WorkbenchState["ui"], "enabled" | "unsaved">;
};

function buildDraftActionConfigs(
  baseDraft: WorkbenchThemeDraft,
  theme: ThemeInput | undefined,
): WorkbenchThemeDraft["actionConfigs"] {
  return Object.fromEntries(
    PLATFORM_ACTIONS.map((action) => {
      const merged = mergeActionConfig(
        baseDraft.actionConfigs[action.id],
        theme?.actionConfigs?.[action.id] || {},
      );
      if (isDesktop() && isDesktopAssetId(merged.imageAssetId) && !merged.imageDataUrl) {
        merged.imageDataUrl = toDesktopAssetUrl(merged.imageAssetId);
      }
      return [action.id, merged];
    }),
  ) as WorkbenchThemeDraft["actionConfigs"];
}

function buildResetActionConfigs(
  baseDraft: WorkbenchThemeDraft,
  theme: ThemeInput | undefined,
  actionConfigs: WorkbenchThemeDraft["actionConfigs"],
): WorkbenchThemeDraft["actionConfigs"] {
  const isBuiltInTheme = THEMES.some((candidate) => candidate.id === theme?.id);
  return isBuiltInTheme
    ? buildDraftActionConfigs(baseDraft, undefined)
    : buildDraftActionConfigs({ ...baseDraft, actionConfigs }, { actionConfigs });
}

function buildDraftCursorBindings(baseDraft: WorkbenchThemeDraft, theme: ThemeInput) {
  return Object.fromEntries(CURSOR_STATES.map((state) => {
    const binding = theme.cursorBindings?.[state.id];
    return [state.id, binding
      ? {
          mode: state.id === "default" || binding.mode === "override" ? "override" : "inherit",
          actionId: binding.actionId || "leftClick",
        }
      : baseDraft.cursorBindings[state.id]];
  })) as WorkbenchThemeDraft["cursorBindings"];
}

function buildDraftFromTheme(theme: ThemeInput): WorkbenchThemeDraft {
  const baseDraft = createThemeDraft(theme.id) as WorkbenchThemeDraft;
  const actionConfigs = buildDraftActionConfigs(baseDraft, theme);
  const keyFeedbackConfig = normalizeKeyFeedbackConfig(
    theme.keyFeedbackConfig || baseDraft.keyFeedbackConfig,
  );
  return {
    ...baseDraft,
    cursorBindings: buildDraftCursorBindings(baseDraft, theme),
    cursorSkin: theme.cursorSkin || baseDraft.cursorSkin,
    keyFeedbackConfig,
    resetKeyFeedbackConfig: keyFeedbackConfig,
    actionConfigs,
    resetActionConfigs: buildResetActionConfigs(baseDraft, theme, actionConfigs),
    atmosphere: (theme.atmosphere as Record<string, unknown> | undefined) || baseDraft.atmosphere,
  };
}

export function themePackToThemeLibraryItem(theme: unknown, fallbackIndex = 0): ThemeLibraryItem {
  return buildThemeLibraryItem(theme, fallbackIndex) as ThemeLibraryItem;
}

export function draftFromThemePack(theme: unknown): WorkbenchThemeDraft {
  return buildDraftFromTheme((theme || {}) as ThemeInput);
}

function resolveSelectedThemeId(
  themeLibrary: ThemeLibraryItem[],
  draftsByTheme: Record<string, WorkbenchThemeDraft>,
  activeThemeId?: string,
): string {
  if (activeThemeId && draftsByTheme[activeThemeId]) return activeThemeId;
  return themeLibrary[0]?.id || THEMES[0]?.id || "";
}

export function createWorkbenchThemeState(
  themeLibrary: ThemeLibraryItem[] = THEMES as ThemeLibraryItem[],
): {
  themeLibrary: ThemeLibraryItem[];
  draftsByTheme: Record<string, WorkbenchThemeDraft>;
  selectedThemeId: string;
} {
  const nextThemeLibrary = themeLibrary.length ? themeLibrary : THEMES as ThemeLibraryItem[];
  const nextDraftsByTheme = buildThemeDrafts(nextThemeLibrary) as Record<string, WorkbenchThemeDraft>;
  return {
    themeLibrary: nextThemeLibrary,
    draftsByTheme: nextDraftsByTheme,
    selectedThemeId: resolveSelectedThemeId(nextThemeLibrary, nextDraftsByTheme),
  };
}

export function hydrateWorkbenchState(value: unknown, site: WorkbenchSiteInput): HydratedWorkbenchState {
  const config = normalizeStoredConfig(value);
  const themes = config.themes || [];
  const themeLibrary = themes.map((theme, index) => themePackToThemeLibraryItem(theme, index));
  const baseThemeState = createWorkbenchThemeState(themeLibrary);
  const draftsByTheme = { ...baseThemeState.draftsByTheme };
  themes.forEach((theme) => { draftsByTheme[theme.id] = buildDraftFromTheme(theme as ThemeInput); });
  const rules = contextRulesToWorkbench(config.contextRules || []);

  return {
    workspaceId: "workbench",
    selection: {
      themeId: resolveSelectedThemeId(themeLibrary, draftsByTheme, config.activeThemeId),
      actionId: "leftClick",
      cursorStateId: "default",
    },
    ...rules,
    themeLibrary,
    ui: { enabled: config.enabled !== false, unsaved: false },
    site: {
      host: site.host,
      isSupportedPage: site.isSupportedPage ?? false,
      tabId: site.tabId ?? null,
    },
    draftsByTheme,
  };
}
