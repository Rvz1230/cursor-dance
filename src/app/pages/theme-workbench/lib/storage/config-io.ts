import { getWorkbenchRepository } from "./repository";
import type { WorkbenchEditorState } from "./repository/types";

export function readExtensionConfig(): Promise<CursorDanceConfigRecord> {
  return getWorkbenchRepository().readConfig();
}

export function writeExtensionConfig(config: unknown): Promise<CursorDanceConfigRecord> {
  return getWorkbenchRepository().writeConfig(config);
}

export function readLivePreviewConfig(): Promise<CursorDanceConfigRecord | null> {
  return getWorkbenchRepository().readLivePreview();
}

export function writeLivePreviewConfig(config: unknown): Promise<CursorDanceConfigRecord> {
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
