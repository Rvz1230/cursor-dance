import type {
  ContextResolver,
  RuntimeListener,
  RuntimeUnsubscribe,
} from "@/shared/effect-runtime/contracts";

export interface DesktopContextBridge<TContext> {
  getActiveWindow(): Promise<TContext>;
  onActiveWindowChanged(listener: (snapshot: TContext) => void): RuntimeUnsubscribe;
}

export interface DesktopContextResolver<TContext> extends ContextResolver<TContext | null> {
  refresh(): Promise<void>;
  dispose(): void;
}

export function createDesktopContextResolver<TContext>(
  bridge: DesktopContextBridge<TContext>,
  onError: (error: unknown) => void = () => {},
): DesktopContextResolver<TContext> {
  const listeners = new Set<RuntimeListener<TContext | null>>();
  let snapshot: TContext | null = null;
  let revision = 0;
  let unsubscribeBridge: RuntimeUnsubscribe | null = null;

  function notify(listener: RuntimeListener<TContext | null>, value: TContext | null): void {
    Promise.resolve(listener(value)).catch(onError);
  }

  function publish(value: TContext): void {
    revision += 1;
    snapshot = value;
    for (const listener of listeners) notify(listener, snapshot);
  }

  async function refresh(): Promise<void> {
    const startedAtRevision = revision;
    try {
      const value = await bridge.getActiveWindow();
      if (revision === startedAtRevision) publish(value);
    } catch (error) {
      onError(error);
    }
  }

  function start(): void {
    if (unsubscribeBridge) return;
    unsubscribeBridge = bridge.onActiveWindowChanged(publish);
    void refresh();
  }

  function stop(): void {
    unsubscribeBridge?.();
    unsubscribeBridge = null;
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      start();
      if (snapshot !== null) notify(listener, snapshot);
      return () => {
        listeners.delete(listener);
        if (!listeners.size) stop();
      };
    },
    refresh,
    dispose() {
      listeners.clear();
      stop();
    },
  };
}
