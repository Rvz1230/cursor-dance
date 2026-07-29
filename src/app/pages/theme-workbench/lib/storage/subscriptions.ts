import { getWorkbenchRepository } from "./repository";
import type {
  RepositoryListener,
  RuntimeDiagnosticEntry,
} from "./repository/types";

export function subscribeExtensionConfig(onChange: RepositoryListener<CursorDanceConfigRecord>) {
  return getWorkbenchRepository().subscribeConfig(onChange);
}

export function subscribeLivePreviewConfig(onChange: RepositoryListener<CursorDanceConfigRecord | null>) {
  return getWorkbenchRepository().subscribeLivePreview(onChange);
}

export function subscribeRuntimeDiagnostics(onChange: RepositoryListener<RuntimeDiagnosticEntry>) {
  return getWorkbenchRepository().subscribeRuntimeDiagnostics(onChange);
}
