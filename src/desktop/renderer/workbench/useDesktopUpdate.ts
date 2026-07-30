import { useCallback, useEffect, useState } from "react";
import type { DesktopUpdateState } from "../../../shared/desktop-update";

const UNSUPPORTED_STATE: DesktopUpdateState = { status: "unsupported" };

export function useDesktopUpdate() {
  const bridge = typeof window !== "undefined" ? window.cursorDanceApp : undefined;
  const [state, setState] = useState<DesktopUpdateState>(UNSUPPORTED_STATE);

  useEffect(() => {
    if (!bridge) return;
    let active = true;
    let receivedPush = false;
    const unsubscribe = bridge.onUpdateStateChanged((nextState) => {
      receivedPush = true;
      if (active) setState(nextState);
    });
    void bridge.getUpdateState()
      .then((nextState) => {
        if (active && !receivedPush) setState(nextState);
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [bridge]);

  const runPrimaryAction = useCallback(async () => {
    if (!bridge) return;
    try {
      if (state.status === "available") {
        setState(await bridge.downloadUpdate());
      } else if (state.status === "downloaded") {
        await bridge.installUpdate();
      } else if (["idle", "up-to-date", "error"].includes(state.status)) {
        setState(await bridge.checkForUpdates());
      }
    } catch (error) {
      setState({
        status: "error",
        version: state.version,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [bridge, state]);

  return { state, runPrimaryAction };
}
