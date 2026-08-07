import { useEffect, useState } from "react";
import type { ActiveWindowSnapshot } from "@/shared/app-rules";

type WelcomeState = "loading" | "open" | "closed";

interface DesktopWorkbenchRuntimeState {
  welcomeState: WelcomeState;
  accessibilityAuthorized: boolean | null;
  activeWindowSnapshot: ActiveWindowSnapshot | null;
}

const INITIAL_RUNTIME_STATE: DesktopWorkbenchRuntimeState = {
  welcomeState: "loading",
  accessibilityAuthorized: null,
  activeWindowSnapshot: null,
};

export function loadDesktopWorkbenchBootstrap(deps: {
  getFirstRun(): Promise<boolean>;
  getActiveWindow(): Promise<ActiveWindowSnapshot>;
}): {
  welcomeState: Promise<WelcomeState>;
  activeWindowSnapshot: Promise<ActiveWindowSnapshot | null>;
} {
  return {
    welcomeState: deps.getFirstRun().then((firstRun) => firstRun ? "open" : "closed", () => "closed"),
    activeWindowSnapshot: deps.getActiveWindow().catch(() => null),
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
    const bootstrap = loadDesktopWorkbenchBootstrap(bridge);
    void bootstrap.welcomeState.then((welcomeState) => {
      if (cancelled) return;
      setRuntimeState((current) => ({
        ...current,
        welcomeState,
      }));
    });
    void bootstrap.activeWindowSnapshot.then((snapshot) => {
      if (cancelled || receivedActiveWindowEvent || !snapshot) return;
      setRuntimeState((current) => ({
        ...current,
        activeWindowSnapshot: snapshot,
        accessibilityAuthorized: snapshot.authorized,
      }));
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

  function refreshActiveWindow(): void {
    const bridge = typeof window !== "undefined" ? window.cursorDanceApp : undefined;
    if (!bridge) return;
    void bridge.getActiveWindow().then((snapshot) => {
      setRuntimeState((current) => ({
        ...current,
        activeWindowSnapshot: snapshot,
        accessibilityAuthorized: snapshot.authorized,
      }));
    }).catch(() => {
      // Keep the last useful snapshot; the next active-window event can recover automatically.
    });
  }

  return {
    ...runtimeState,
    closeWelcome,
    openAccessibilitySettings,
    refreshActiveWindow,
  };
}
