import { getWorkbenchRepository } from "./repository";
import type { RuntimeDiagnosticEntry } from "./repository/types";

export function readRuntimeErrors(): Promise<RuntimeDiagnosticEntry[]> {
  return getWorkbenchRepository().readRuntimeErrors();
}

export function clearRuntimeErrors(): Promise<void> {
  return getWorkbenchRepository().clearRuntimeErrors();
}

export function readDiagnosticDebugFlag(): Promise<boolean> {
  return getWorkbenchRepository().readDiagnosticDebugFlag();
}

export function readRuntimeDiagnostics(): Promise<RuntimeDiagnosticEntry[]> {
  return getWorkbenchRepository().readRuntimeDiagnostics();
}

export function clearRuntimeDiagnostics(): Promise<void> {
  return getWorkbenchRepository().clearRuntimeDiagnostics();
}

export function writeDiagnosticDebugFlag(enabled: boolean): Promise<void> {
  return getWorkbenchRepository().writeDiagnosticDebugFlag(enabled);
}
