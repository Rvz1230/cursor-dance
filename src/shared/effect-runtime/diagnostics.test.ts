import { afterEach, describe, expect, it, vi } from "vitest";
import { createDiagnostics } from "./diagnostics";

afterEach(() => vi.restoreAllMocks());

function createStorage(value: string | null = null): Storage {
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  } as unknown as Storage;
}

function createWindow(href = "https://example.com/", storage = createStorage()): Window {
  return {
    location: { href },
    localStorage: storage,
    dispatchEvent: vi.fn(),
  } as unknown as Window;
}

describe("shared diagnostics runtime", () => {
  it("resolves synchronous flags and accepts external overrides", () => {
    let toggle: ((enabled: unknown) => void) | undefined;
    const diagnostics = createDiagnostics({
      window: createWindow("https://example.com/?cursordance-debug=yes"),
      onExternalToggle: (nextToggle) => {
        toggle = nextToggle;
      },
    });

    expect(diagnostics.isEnabled()).toBe(true);
    toggle?.(false);
    expect(diagnostics.isEnabled()).toBe(false);
    toggle?.("debug");
    expect(diagnostics.isEnabled()).toBe(true);
  });

  it("keeps a bounded event buffer and isolates failing sinks", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const onEvent = vi.fn(() => {
      throw new Error("sink unavailable");
    });
    const diagnostics = createDiagnostics({
      window: createWindow(),
      initialEnabled: true,
      onEvent,
    });

    for (let index = 0; index < 201; index += 1) {
      diagnostics.log("pointer.move", { index });
    }

    expect(diagnostics.getEvents()).toHaveLength(200);
    expect(diagnostics.getEvents()[0].index).toBe(1);
    expect(diagnostics.getEvents()[199].index).toBe(200);
    expect(onEvent).toHaveBeenCalledTimes(201);
  });

  it("describes DOM and media targets without relying on the global realm", () => {
    class FakeElement {
      tagName = "BUTTON";
      id = "save";
      className = "primary large highlighted extra";
      textContent = " Save current theme ";
      getAttribute(name: string): string | null {
        return name === "role" ? "button" : null;
      }
    }
    const window = createWindow() as Window & { Element?: typeof Element };
    window.Element = FakeElement as unknown as typeof Element;
    const diagnostics = createDiagnostics({ window });
    const media = Object.assign(new FakeElement(), {
      paused: false,
      muted: true,
      volume: 0.4567,
      readyState: 4,
      currentSrc: "https://example.com/audio.mp3",
    });

    expect(diagnostics.describeTarget(media)).toEqual({
      selector: "button#save.primary.large.highlighted",
      role: "button",
      text: "Save current theme",
    });
    expect(diagnostics.describeMedia(media)).toMatchObject({
      paused: false,
      muted: true,
      volume: 0.457,
      readyState: 4,
      currentSrc: "https://example.com/audio.mp3",
    });
  });
});
