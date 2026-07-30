import { describe, expect, it, vi } from "vitest";
import { createAudioRuntime } from "./audio-runtime";

function createHarness(overrides: Record<string, unknown> = {}) {
  const oscillators: Array<Record<string, unknown>> = [];
  class FakeAudioContext {
    state = "running";
    currentTime = 1;
    destination = {};
    resume = vi.fn(async () => {});
    suspend = vi.fn(async () => {});
    createGain() {
      return {
        connect: vi.fn(),
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
      };
    }
    createOscillator() {
      const oscillator = {
        type: "sine",
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(oscillator);
      return oscillator;
    }
  }
  const audioConfig = {
    sound: true,
    volume: 80,
    soundFile: "woodfish-deep.wav",
    soundTriggerMode: "每次触发",
    ...overrides,
  };
  const state: { audioContext?: AudioContext | null; lastSoundAtByAction?: Record<string, number> } = {};
  const beforePlay = vi.fn();
  const runtime = createAudioRuntime({
    window: { AudioContext: FakeAudioContext } as unknown as Window,
    state,
    configStore: {
      getActionAudioConfig: () => audioConfig,
      getActionTriggerConfig: () => ({ holdMs: 0 }),
    },
    beforePlay,
  });
  return { beforePlay, oscillators, runtime, state };
}

describe("shared audio runtime", () => {
  it("skips disabled audio before creating a context or invoking platform hooks", () => {
    const { beforePlay, runtime, state } = createHarness({ sound: false });

    runtime.playSound({}, "leftClick");

    expect(beforePlay).not.toHaveBeenCalled();
    expect(state.audioContext).toBeUndefined();
  });

  it("invokes the platform hook and synthesizes both preset tones", () => {
    const { beforePlay, oscillators, runtime } = createHarness();

    runtime.playSound({}, "leftClick", { comboIndex: 2 });

    expect(beforePlay).toHaveBeenCalledWith({}, "leftClick");
    expect(oscillators).toHaveLength(2);
    expect(oscillators[0]?.type).toBe("triangle");
  });

  it("does not invoke the platform hook for throttled playback", () => {
    const { beforePlay, runtime, state } = createHarness({
      soundTriggerMode: "节流播放",
      soundDelay: 500,
    });
    state.lastSoundAtByAction = { wheel: Date.now() };

    runtime.playSound({}, "wheel");

    expect(beforePlay).not.toHaveBeenCalled();
  });

  it("suspends an existing context without creating one", () => {
    const { runtime, state } = createHarness();

    runtime.suspend();
    expect(state.audioContext).toBeUndefined();

    runtime.playSound({}, "leftClick");
    const context = state.audioContext as AudioContext & { suspend: ReturnType<typeof vi.fn> };
    runtime.suspend();

    expect(context.suspend).toHaveBeenCalledOnce();
  });
});
