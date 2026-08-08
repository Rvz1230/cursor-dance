import type { CursorSkin } from "@/shared/domain/cursor-dance";
import { normalizeKeyFeedbackConfig } from "@/shared/config/key-feedback";
import { isDesktop } from "@/shared/runtime";
import {
  isDesktopAssetId,
  toDesktopAssetUrl,
} from "@/shared/asset-reference";
import type {
  WorkbenchThemeMeta,
  WorkbenchState,
  WorkbenchTheme,
  WorkbenchThemeDraft,
} from "../../hooks/workbenchStateTypes";
import {
  PLATFORM_ACTIONS,
  CURSOR_STATES,
  THEMES,
  buildWorkbenchThemeMeta,
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

type WorkbenchSite = WorkbenchState["runtime"]["site"];
type WorkbenchSiteInput = Pick<WorkbenchSite, "host"> & Partial<WorkbenchSite>;
type HydratedWorkbenchState = {
  domain: WorkbenchState["domain"];
  runtime: Pick<WorkbenchState["runtime"], "site">;
  status: Pick<WorkbenchState["status"], "unsaved">;
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

export function themePackToWorkbenchThemeMeta(theme: unknown, fallbackIndex = 0): WorkbenchThemeMeta {
  return buildWorkbenchThemeMeta(theme, fallbackIndex) as WorkbenchThemeMeta;
}

export function draftFromThemePack(theme: unknown): WorkbenchThemeDraft {
  return buildDraftFromTheme((theme || {}) as ThemeInput);
}

function themePackToWorkbenchTheme(theme: unknown, fallbackIndex = 0): WorkbenchTheme {
  return {
    meta: themePackToWorkbenchThemeMeta(theme, fallbackIndex),
    draft: draftFromThemePack(theme),
  };
}

function resolveSelectedThemeId(
  themes: WorkbenchTheme[],
  activeThemeId?: string,
): string {
  if (activeThemeId && themes.some((theme) => theme.meta.id === activeThemeId)) return activeThemeId;
  return themes[0]?.meta.id || THEMES[0]?.id || "";
}

export function createWorkbenchThemeState(
  themeMetadata: WorkbenchThemeMeta[] = THEMES as WorkbenchThemeMeta[],
): {
  themes: WorkbenchTheme[];
  selectedThemeId: string;
} {
  const nextThemeMetadata = themeMetadata.length ? themeMetadata : THEMES as WorkbenchThemeMeta[];
  const themes = nextThemeMetadata.map((meta) => ({
    meta,
    draft: createThemeDraft(meta.id) as WorkbenchThemeDraft,
  }));
  return {
    themes,
    selectedThemeId: resolveSelectedThemeId(themes),
  };
}

export function hydrateWorkbenchState(value: unknown, site: WorkbenchSiteInput): HydratedWorkbenchState {
  const config = normalizeStoredConfig(value);
  const storedThemes = config.themes || [];
  const themes = storedThemes.length
    ? storedThemes.map((theme, index) => themePackToWorkbenchTheme(theme, index))
    : createWorkbenchThemeState().themes;
  const rules = contextRulesToWorkbench(config.contextRules || []);

  return {
    domain: {
      enabled: config.enabled !== false,
      activeThemeId: resolveSelectedThemeId(themes, config.activeThemeId),
      themes,
      ...rules,
    },
    status: { unsaved: false },
    runtime: {
      site: {
        host: site.host,
        path: site.path ?? "/",
        isSupportedPage: site.isSupportedPage ?? false,
        tabId: site.tabId ?? null,
      },
    },
  };
}
