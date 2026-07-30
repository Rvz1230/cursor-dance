import { useEffect, useState } from "react";
import type { ActiveWindowSnapshot } from "@/shared/app-rules";

type WelcomeState = "loading" | "open" | "closed";

export interface DesktopWorkbenchRuntimeState {
  welcomeState: WelcomeState;
  accessibilityAuthorized: boolean | null;
  activeWindowSnapshot: ActiveWindowSnapshot | null;
}

const INITIAL_RUNTIME_STATE: DesktopWorkbenchRuntimeState = {
  welcomeState: "loading",
  accessibilityAuthorized: null,
  activeWindowSnapshot: null,
};

export function resolveDesktopWorkbenchBootstrap(
  firstRunResult: PromiseSettledResult<boolean>,
  activeWindowResult: PromiseSettledResult<ActiveWindowSnapshot>,
): DesktopWorkbenchRuntimeState {
  const activeWindowSnapshot = activeWindowResult.status === "fulfilled"
    ? activeWindowResult.value
    : null;
  return {
    welcomeState: firstRunResult.status === "fulfilled" && firstRunResult.value === true
      ? "open"
      : "closed",
    accessibilityAuthorized: activeWindowSnapshot?.authorized === true,
    activeWindowSnapshot,
  };
}

export function useDesktopWorkbenchRuntime() {
  const [runtimeState, setRuntimeState] = useState(INITIAL_RUNTIME_STATE);

  useEffect(() => {
    const bridge = typeof window !== "undefined" ? window.cursorDanceApp : undefined;
    if (!bridge) {
      setRuntimeState((current) => ({ ...current, welcomeState: "closed" }));
      return undefined;
    }

    let cancelled = false;
    let receivedActiveWindowEvent = false;
    const unsubscribeActiveWindow = bridge.onActiveWindowChanged((snapshot) => {
      if (cancelled) return;
      receivedActiveWindowEvent = true;
      setRuntimeState((current) => ({
        ...current,
        activeWindowSnapshot: snapshot,
        accessibilityAuthorized: snapshot.authorized,
      }));
    });
    void Promise.allSettled([
      bridge.getFirstRun(),
      bridge.getActiveWindow(),
    ]).then(([firstRunResult, activeWindowResult]) => {
      if (cancelled) return;
      const bootstrapState = resolveDesktopWorkbenchBootstrap(firstRunResult, activeWindowResult);
      setRuntimeState((current) => receivedActiveWindowEvent
        ? { ...current, welcomeState: bootstrapState.welcomeState }
        : bootstrapState);
    });

    return () => {
      cancelled = true;
      unsubscribeActiveWindow();
    };
  }, []);

  function closeWelcome(): void {
    setRuntimeState((current) => ({ ...current, welcomeState: "closed" }));
    void window.cursorDanceApp?.markFirstRunComplete().catch(() => {
      // A failed write only means the welcome dialog may reappear next launch.
    });
  }

  function openAccessibilitySettings(): void {
    const target = "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";
    void window.cursorDanceApp?.openExternal(target).catch(() => {
      // The user can still open System Settings manually.
    });
  }

  return {
    ...runtimeState,
    closeWelcome,
    openAccessibilitySettings,
  };
}
