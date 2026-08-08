import { getWorkbenchRepository } from "./repository";
import type { WorkbenchEditorState } from "./repository/types";
import type { CursorDanceConfig } from "@/shared/domain/cursor-dance";

type ConfigUpdater = (
  current: CursorDanceConfig,
) => CursorDanceConfig | Promise<CursorDanceConfig>;

let configMutationQueue: Promise<void> = Promise.resolve();
let livePreviewMutationQueue: Promise<void> = Promise.resolve();

function enqueueMutation<T>(
  queue: Promise<void>,
  setQueue: (next: Promise<void>) => void,
  operation: () => Promise<T>,
): Promise<T> {
  const result = queue.catch(() => undefined).then(operation);
  setQueue(result.then(() => undefined, () => undefined));
  return result;
}

export function readExtensionConfig(): Promise<CursorDanceConfig> {
  return configMutationQueue.then(() => getWorkbenchRepository().readConfig());
}

/** Serialize read-modify-write operations so rapid UI commands cannot overwrite each other. */
export function updateExtensionConfig(updater: ConfigUpdater): Promise<CursorDanceConfig> {
  return enqueueMutation(
    configMutationQueue,
    (next) => { configMutationQueue = next; },
    async () => {
      const repository = getWorkbenchRepository();
      const current = await repository.readConfig();
      return repository.writeConfig(await updater(current));
    },
  );
}

export function readLivePreviewConfig(): Promise<CursorDanceConfig | null> {
  return livePreviewMutationQueue.then(() => getWorkbenchRepository().readLivePreview());
}

export function writeLivePreviewConfig(config: unknown): Promise<CursorDanceConfig> {
  return enqueueMutation(
    livePreviewMutationQueue,
    (next) => { livePreviewMutationQueue = next; },
    () => getWorkbenchRepository().writeLivePreview(config),
  );
}

export function clearLivePreviewConfig(): Promise<void> {
  return enqueueMutation(
    livePreviewMutationQueue,
    (next) => { livePreviewMutationQueue = next; },
    () => getWorkbenchRepository().clearLivePreview(),
  );
}

export function readEditorState(): Promise<WorkbenchEditorState | null> {
  return getWorkbenchRepository().readEditorState();
}

export function writeEditorState(state: WorkbenchEditorState): Promise<void> {
  return getWorkbenchRepository().writeEditorState(state);
}

export const __testing__ = {
  resetMutationQueues(): void {
    configMutationQueue = Promise.resolve();
    livePreviewMutationQueue = Promise.resolve();
  },
};
