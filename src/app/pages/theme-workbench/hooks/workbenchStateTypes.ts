import type { Dispatch, MutableRefObject } from "react";
import type { AppRule } from "@/shared/app-rules";
import type { KeyFeedbackConfig } from "@/shared/config/key-feedback";
import type { RecentCursorAsset } from "../lib/storage/repository/types";
import type { CursorBinding, CursorDanceConfig, CursorSkin } from "@/shared/domain/cursor-dance";

export type WorkbenchActionConfig = Record<string, unknown>;

/**
 * Editor state around the canonical theme fields. `reset*` values are UI baselines only;
 * persistence strips them and writes the shared domain model directly.
 */
export interface WorkbenchThemeDraft {
  actionConfigs: Record<string, WorkbenchActionConfig>;
  resetActionConfigs: Record<string, WorkbenchActionConfig>;
  cursorBindings: Record<string, CursorBinding>;
  cursorSkin: CursorSkin;
  keyFeedbackConfig: KeyFeedbackConfig;
  resetKeyFeedbackConfig: KeyFeedbackConfig;
  atmosphere: Record<string, unknown>;
}

export type CursorCommandDraft = Pick<
  WorkbenchThemeDraft,
  "cursorBindings" | "cursorSkin"
>;

/** Workbench-only presentation metadata; never serialized as the runtime theme model. */
export interface ThemeLibraryItem {
  id: string;
  name: string;
  kind: string;
  summary: string;
  description?: string;
  tone: string;
  icon?: string;
}

export type WorkbenchRuleAction = "disable" | { enable: boolean; theme?: string };

export interface SiteRule {
  id: string;
  pattern: {
    type: "exact" | "glob" | "path";
    value: string;
    hostType?: "exact" | "glob";
  };
  action: WorkbenchRuleAction;
  enabled?: boolean;
}

export type NewSiteRule = Omit<SiteRule, "id"> & { id?: string };
export type NewAppRule = Omit<AppRule, "id"> & { id?: string };

export interface WorkbenchSelection {
  themeId: string;
  actionId: string;
  cursorStateId: string;
}

interface WorkbenchUiState {
  enabled: boolean;
  unsaved: boolean;
  isHydrated: boolean;
  isSaving: boolean;
  saveError: string;
  dirtyThemes: Record<string, boolean>;
}

export interface WorkbenchState {
  workspaceId: string;
  selection: WorkbenchSelection;
  siteRules: SiteRule[];
  appRules: AppRule[];
  ui: WorkbenchUiState;
  site: {
    host: string;
    isSupportedPage: boolean;
    tabId: number | null;
  };
  recentCursorAssets: RecentCursorAsset[];
  themeLibrary: ThemeLibraryItem[];
  draftsByTheme: Record<string, WorkbenchThemeDraft>;
}

export type WorkbenchPersistableState = Pick<
  WorkbenchState,
  "selection" | "siteRules" | "appRules" | "themeLibrary" | "draftsByTheme"
> & {
  ui: Pick<WorkbenchUiState, "enabled">;
};

type HydratePayload = Partial<Omit<WorkbenchState, "ui">> & {
  ui?: Partial<WorkbenchUiState>;
};

export type WorkbenchAction =
  | { type: "hydrate"; payload: HydratePayload }
  | { type: "workspace/set" | "theme/select" | "action/select" | "cursor-state/select"; payload: string }
  | { type: "global-enabled/set"; payload: boolean }
  | { type: "theme/library-add"; payload: { theme: ThemeLibraryItem; draft: WorkbenchThemeDraft; select?: boolean } }
  | { type: "theme/library-remove"; payload: { themeId: string; nextSelectedThemeId?: string } }
  | { type: "theme/library-rename"; payload: { themeId: string; name: string } }
  | { type: "theme/library-update-icon"; payload: { themeId: string; icon: string } }
  | { type: "rules/add"; payload:
      | { collection: "siteRules"; rule: NewSiteRule }
      | { collection: "appRules"; rule: NewAppRule }
    }
  | { type: "rules/update"; payload: { collection: "siteRules" | "appRules"; id: string; updates: Partial<SiteRule | AppRule> } }
  | { type: "rules/delete" | "rules/toggle"; payload: { collection: "siteRules" | "appRules"; id: string } }
  | { type: "rules/reorder"; payload: { collection: "siteRules" | "appRules"; from: number; to: number } }
  | { type: "rules/clear-all"; payload: { collection: "siteRules" | "appRules" } }
  | { type: "save/start" }
  | { type: "save/success"; payload?: { preserveUnsaved?: boolean } }
  | { type: "save/error"; payload?: string }
  | { type: "recent-assets/set"; payload: RecentCursorAsset[] }
  | { type: "theme/update-current"; payload: ThemeUpdater }
  | { type: "theme/reset-current" }
  | { type: "theme/discard-changes"; payload: { themeId: string; draft: WorkbenchThemeDraft } }
  | { type: "key-feedback/update"; payload: Partial<KeyFeedbackConfig> };

export type WorkbenchDispatch = Dispatch<WorkbenchAction>;
export type WorkbenchConfigRef = MutableRefObject<CursorDanceConfig | null>;
type ThemeUpdater = (current: WorkbenchThemeDraft) => WorkbenchThemeDraft;
