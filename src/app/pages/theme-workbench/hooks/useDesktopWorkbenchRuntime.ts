import { useEffect, useState } from "react";
import type { ActiveWindowSnapshot } from "@/shared/app-rules";
import {
  isAccessibilityReady,
  type DesktopAccessibilityState,
} from "@/shared/desktop-accessibility";

type WelcomeState = "loading" | "open" | "closed";

interface DesktopWorkbenchRuntimeState {
  welcomeState: WelcomeState;
  accessibilityState: DesktopAccessibilityState | null;
  accessibilityAuthorized: boolean | null;
  activeWindowSnapshot: ActiveWindowSnapshot | null;
}

const INITIAL_RUNTIME_STATE: DesktopWorkbenchRuntimeState = {
  welcomeState: "loading",
  accessibilityState: null,
  accessibilityAuthorized: null,
  activeWindowSnapshot: null,
};

export function loadDesktopWorkbenchBootstrap(deps: {
  getFirstRun(): Promise<boolean>;
  getActiveWindow(): Promise<ActiveWindowSnapshot>;
  getAccessibilityState(): Promise<DesktopAccessibilityState>;
}): {
  welcomeState: Promise<WelcomeState>;
  activeWindowSnapshot: Promise<ActiveWindowSnapshot | null>;
  accessibilityState: Promise<DesktopAccessibilityState | null>;
} {
  return {
    welcomeState: deps.getFirstRun().then((firstRun) => firstRun ? "open" : "closed", () => "closed"),
    activeWindowSnapshot: deps.getActiveWindow().catch(() => null),
    accessibilityState: deps.getAccessibilityState().catch(() => null),
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
    let receivedAccessibilityEvent = false;
    const unsubscribeActiveWindow = bridge.onActiveWindowChanged((snapshot) => {
      if (cancelled) return;
      receivedActiveWindowEvent = true;
      setRuntimeState((current) => ({
        ...current,
        activeWindowSnapshot: snapshot,
      }));
    });
    const unsubscribeAccessibility = bridge.onAccessibilityStateChanged((accessibilityState) => {
      if (cancelled) return;
      receivedAccessibilityEvent = true;
      setRuntimeState((current) => ({
        ...current,
        accessibilityState,
        accessibilityAuthorized: isAccessibilityReady(accessibilityState),
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
      }));
    });
    void bootstrap.accessibilityState.then((accessibilityState) => {
      if (cancelled || receivedAccessibilityEvent || !accessibilityState) return;
      setRuntimeState((current) => ({
        ...current,
        accessibilityState,
        accessibilityAuthorized: isAccessibilityReady(accessibilityState),
      }));
    });

    return () => {
      cancelled = true;
      unsubscribeActiveWindow();
      unsubscribeAccessibility();
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

  function requestAccessibility(): void {
    const bridge = typeof window !== "undefined" ? window.cursorDanceApp : undefined;
    if (!bridge) return;
    void bridge.requestAccessibility().then((accessibilityState) => {
      setRuntimeState((current) => ({
        ...current,
        accessibilityState,
        accessibilityAuthorized: isAccessibilityReady(accessibilityState),
      }));
    }).catch(() => {
      // 轮询与下次 app activate 仍会继续探测授权状态。
    });
  }

  function refreshActiveWindow(): void {
    const bridge = typeof window !== "undefined" ? window.cursorDanceApp : undefined;
    if (!bridge) return;
    void bridge.getActiveWindow().then((snapshot) => {
      setRuntimeState((current) => ({
        ...current,
        activeWindowSnapshot: snapshot,
      }));
    }).catch(() => {
      // Keep the last useful snapshot; the next active-window event can recover automatically.
    });
  }

  return {
    ...runtimeState,
    closeWelcome,
    openAccessibilitySettings,
    requestAccessibility,
    refreshActiveWindow,
  };
}
