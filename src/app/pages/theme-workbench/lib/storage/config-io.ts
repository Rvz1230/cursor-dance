import { getWorkbenchRepository } from "./repository";
import type { WorkbenchEditorState } from "./repository/types";
import type { CursorDanceConfig } from "@/shared/config/default-config";

export function readExtensionConfig(): Promise<CursorDanceConfig> {
  return getWorkbenchRepository().readConfig();
}

export function writeExtensionConfig(config: unknown): Promise<CursorDanceConfig> {
  return getWorkbenchRepository().writeConfig(config);
}

export function readLivePreviewConfig(): Promise<CursorDanceConfig | null> {
  return getWorkbenchRepository().readLivePreview();
}

export function writeLivePreviewConfig(config: unknown): Promise<CursorDanceConfig> {
  return getWorkbenchRepository().writeLivePreview(config);
}

export function clearLivePreviewConfig(): Promise<void> {
  return getWorkbenchRepository().clearLivePreview();
}

export function readEditorState(): Promise<WorkbenchEditorState | null> {
  return getWorkbenchRepository().readEditorState();
}

export function writeEditorState(state: WorkbenchEditorState): Promise<void> {
  return getWorkbenchRepository().writeEditorState(state);
}
