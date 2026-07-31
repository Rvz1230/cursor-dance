import { getWorkbenchRepository } from "./repository";
import type {
  RepositoryListener,
  RuntimeDiagnosticEntry,
} from "./repository/types";
import type { CursorDanceConfig } from "@/shared/config/default-config";

export function subscribeExtensionConfig(onChange: RepositoryListener<CursorDanceConfig>) {
  return getWorkbenchRepository().subscribeConfig(onChange);
}

export function subscribeLivePreviewConfig(onChange: RepositoryListener<CursorDanceConfig | null>) {
  return getWorkbenchRepository().subscribeLivePreview(onChange);
}

export function subscribeRuntimeDiagnostics(onChange: RepositoryListener<RuntimeDiagnosticEntry>) {
  return getWorkbenchRepository().subscribeRuntimeDiagnostics(onChange);
}
