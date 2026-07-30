import { afterEach, describe, expect, it, vi } from "vitest";
import { createContentDiagnostics } from "./diagnostics";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function createWindow(): Window {
  const storage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
  return {
    location: { href: "https://example.com/docs" },
    localStorage: storage,
    setTimeout,
    clearTimeout,
    dispatchEvent: vi.fn(),
  } as unknown as Window;
}

describe("extension diagnostics adapter", () => {
  it("syncs the debug flag and batches diagnostic event persistence", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    let storageListener: ((
      changes: Record<string, { newValue?: unknown }>,
      areaName: string,
    ) => void) | undefined;
    const set = vi.fn(async (_items: Record<string, unknown>) => undefined);
    const diagnostics = createContentDiagnostics({
      window: createWindow(),
      chrome: {
        storage: {
          local: {
            get: vi.fn(async () => ({ "cursordance.debug": true })),
            set,
          },
          onChanged: {
            addListener: (listener) => {
              storageListener = listener;
            },
          },
        },
      },
    });

    await vi.waitFor(() => expect(diagnostics.isEnabled()).toBe(true));
    diagnostics.log("runtime.ready");
    diagnostics.log("pointer.down", { button: 0 });
    expect(set).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);
    expect(set).toHaveBeenCalledTimes(1);
    expect(set.mock.calls[0][0]["cursordance.diagnosticEvents"]).toHaveLength(2);

    storageListener?.({ "cursordance.debug": { newValue: false } }, "local");
    expect(diagnostics.isEnabled()).toBe(false);
  });

  it("registers the adapter for the legacy content assembly", () => {
    expect(globalThis.CursorDanceContentModules.createDiagnostics).toBe(createContentDiagnostics);
  });
});
