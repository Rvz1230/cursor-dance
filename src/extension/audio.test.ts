import { afterEach, describe, expect, it, vi } from "vitest";
import { createContentAudioRuntime } from "./audio";

afterEach(() => vi.useRealTimers());

describe("extension audio duck adapter", () => {
  it("restores the original media state after plugin-only playback", () => {
    vi.useFakeTimers();
    class FakeMediaElement {
      volume = 0.8;
      muted = false;
      paused = false;
      readyState = 4;
    }
    const media = new FakeMediaElement();
    const audioConfig = {
      sound: true,
      volume: 80,
      soundBlendMode: "仅插件音效",
      soundFadeOut: 120,
      soundDelay: 0,
    };
    const runtime = createContentAudioRuntime({
      window: {
        HTMLMediaElement: FakeMediaElement,
        location: { hostname: "example.com" },
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
      } as unknown as Window,
      document: {
        querySelectorAll: () => [media],
      } as unknown as Document,
      state: { mediaDuckState: new WeakMap() },
      configStore: {
        getActionAudioConfig: () => audioConfig,
        getActionTriggerConfig: () => ({ holdMs: 0 }),
      },
    });

    runtime.playSound({}, "leftClick");
    expect(media).toMatchObject({ volume: 0, muted: true });

    vi.advanceTimersByTime(900);
    expect(media).toMatchObject({ volume: 0.8, muted: false });
  });
});
