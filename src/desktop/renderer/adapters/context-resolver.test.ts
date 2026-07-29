import { describe, expect, it, vi } from "vitest";
import { createDesktopContextResolver, type DesktopContextBridge } from "./context-resolver";

type Context = { processName: string };

describe("desktop context resolver", () => {
  it("publishes the initial and changed contexts through one owned subscription", async () => {
    let bridgeListener: (snapshot: Context) => void = () => {};
    const unsubscribeBridge = vi.fn();
    const bridge: DesktopContextBridge<Context> = {
      getActiveWindow: vi.fn(async () => ({ processName: "Finder" })),
      onActiveWindowChanged(listener) {
        bridgeListener = listener;
        return unsubscribeBridge;
      },
    };
    const listener = vi.fn();
    const resolver = createDesktopContextResolver(bridge);

    const unsubscribe = resolver.subscribe(listener);
    await vi.waitFor(() => expect(listener).toHaveBeenCalledWith({ processName: "Finder" }));
    bridgeListener({ processName: "Code" });
    expect(resolver.getSnapshot()).toEqual({ processName: "Code" });
    expect(listener).toHaveBeenLastCalledWith({ processName: "Code" });

    unsubscribe();
    expect(unsubscribeBridge).toHaveBeenCalledOnce();
  });

  it("does not let a stale initial read overwrite a newer push update", async () => {
    let bridgeListener: (snapshot: Context) => void = () => {};
    let resolveInitial: (snapshot: Context) => void = () => {};
    const initial = new Promise<Context>((resolve) => { resolveInitial = resolve; });
    const bridge: DesktopContextBridge<Context> = {
      getActiveWindow: vi.fn(() => initial),
      onActiveWindowChanged(listener) {
        bridgeListener = listener;
        return () => {};
      },
    };
    const resolver = createDesktopContextResolver(bridge);
    const unsubscribe = resolver.subscribe(() => {});

    bridgeListener({ processName: "Code" });
    resolveInitial({ processName: "Finder" });
    await initial;
    await Promise.resolve();

    expect(resolver.getSnapshot()).toEqual({ processName: "Code" });
    unsubscribe();
  });
});
