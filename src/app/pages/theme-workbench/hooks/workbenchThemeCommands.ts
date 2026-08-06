import { createThemeDraft } from "../model/workbenchSchema";
import {
  buildPreviewThemePackFromWorkbench,
  buildStoredThemePackFromWorkbench,
  buildThemeExportPayload,
  downloadThemePackExport,
  draftFromThemePack,
  previewThemePack,
  readExtensionConfig,
  writeRecentCursorAsset,
} from "../lib/workbenchConfig";
import {
  buildCreateThemePayload,
  buildDeleteThemePlan,
  buildDuplicateThemePayload,
  buildImportedThemePayload,
} from "../lib/themeWorkbenchThemeLifecycle";
import type {
  WorkbenchConfigRef,
  WorkbenchDispatch,
  WorkbenchSelection,
  WorkbenchState,
} from "./workbenchStateTypes";

interface CreateThemeInput {
  name: string;
  description?: string;
  basedOnThemeId?: string;
}

interface WorkbenchThemeCommandOptions {
  state: WorkbenchState;
  selected: WorkbenchSelection;
  configRef: WorkbenchConfigRef;
  dispatch: WorkbenchDispatch;
}

export function createWorkbenchThemeCommands({ state, selected, configRef, dispatch }: WorkbenchThemeCommandOptions) {
  function discardThemeChanges(themeId: string): void {
    const storedConfig = configRef.current;
    const themePack = storedConfig?.themes?.find((theme) => theme.id === themeId);
    const draft = themePack ? draftFromThemePack(themePack) : createThemeDraft(themeId);
    dispatch({ type: "theme/discard-changes", payload: { themeId, draft } });
  }

  async function previewActiveTheme(): Promise<void> {
    const currentConfig = configRef.current ?? (await readExtensionConfig());
    const previewTheme = buildPreviewThemePackFromWorkbench(currentConfig, state);
    await previewThemePack(selected.themeId, previewTheme, selected.actionId);
  }

  async function rememberRecentCursorAsset(assetRecord: unknown): Promise<void> {
    const nextRecentAssets = await writeRecentCursorAsset(assetRecord);
    dispatch({ type: "recent-assets/set", payload: nextRecentAssets });
  }

  function createTheme({ name, description = "", basedOnThemeId = "blank" }: CreateThemeInput): void {
    dispatch({
      type: "theme/add",
      payload: buildCreateThemePayload(
        state.themes,
        { name, description, basedOnThemeId },
      ),
    });
  }

  function duplicateTheme(themeId = selected.themeId): string {
    const { duplicatedName, payload } = buildDuplicateThemePayload(
      state.themes,
      themeId,
    );
    dispatch({ type: "theme/add", payload });
    return duplicatedName;
  }

  function deleteTheme(themeId = selected.themeId): string {
    const { themeName, nextSelectedThemeId } = buildDeleteThemePlan(state.themes, themeId);
    dispatch({
      type: "theme/remove",
      payload: { themeId, nextSelectedThemeId },
    });
    return themeName;
  }

  async function exportTheme(themeId = selected.themeId): Promise<{ fileName: string; payload: unknown } | null> {
    const theme = state.themes.find((item) => item.meta.id === themeId);
    if (!theme) throw new Error("导出失败：没有找到要导出的主题。");

    const previousConfig = configRef.current ?? {
      schemaVersion: 4,
      enabled: state.ui.enabled,
      activeThemeId: state.selection.themeId,
      themes: [],
      contextRules: [],
      performance: { maxActiveEffects: 48 },
    };
    const themePack = buildStoredThemePackFromWorkbench(previousConfig, state, themeId);
    const fileName = await downloadThemePackExport(themePack);
    if (!fileName) return null;
    return { fileName, payload: buildThemeExportPayload(themePack) };
  }

  function importThemeFromText(text: string, fileName = ""): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("导入失败：文件不是合法的 JSON。");
    }
    dispatch({
      type: "theme/add",
      payload: buildImportedThemePayload(state.themes, parsed, fileName),
    });
  }

  function renameTheme(themeId: string, name: string): boolean {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const exists = state.themes.some(
      (theme) => theme.meta.id !== themeId && theme.meta.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exists) return false;
    dispatch({ type: "theme/rename", payload: { themeId, name: trimmed } });
    return true;
  }

  function updateThemeIcon(themeId: string, icon: string): void {
    dispatch({ type: "theme/update-icon", payload: { themeId, icon } });
  }

  return {
    discardThemeChanges,
    previewActiveTheme,
    rememberRecentCursorAsset,
    createTheme,
    duplicateTheme,
    deleteTheme,
    exportTheme,
    importThemeFromText,
    renameTheme,
    updateThemeIcon,
  };
}
