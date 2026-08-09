import { describe, expect, it, vi } from "vitest";
import {
  createCursorTrailSurface,
  mixCursorTrailColor,
  resolveCursorTrailCompositeOperation,
  resolveNextAutoQuality,
} from "./cursor-trail-surface";

function createFixture() {
  const context = {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    closePath: vi.fn(),
    lineCap: "butt",
    lineJoin: "miter",
    lineWidth: 1,
    globalAlpha: 1,
    strokeStyle: "",
    fillStyle: "",
    shadowColor: "",
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
  const lineWidths: number[] = [];
  const strokeStyles: string[] = [];
  const globalAlphas: number[] = [];
  Object.defineProperty(context, "lineWidth", { configurable: true, get: () => lineWidths[lineWidths.length - 1] ?? 1, set: (value) => lineWidths.push(value) });
  Object.defineProperty(context, "strokeStyle", { configurable: true, get: () => strokeStyles[strokeStyles.length - 1] ?? "", set: (value) => strokeStyles.push(String(value)) });
  Object.defineProperty(context, "globalAlpha", { configurable: true, get: () => globalAlphas[globalAlphas.length - 1] ?? 1, set: (value) => globalAlphas.push(value) });
  const canvas = {
    dataset: {},
    style: { cssText: "" },
    width: 0,
    height: 0,
    setAttribute: vi.fn(),
    getContext: vi.fn(() => context),
    remove: vi.fn(),
  } as unknown as HTMLCanvasElement;
  const root = {
    clientWidth: 320,
    clientHeight: 180,
    appendChild: vi.fn(),
  } as unknown as HTMLElement;
  const frames: FrameRequestCallback[] = [];
  const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  let time = 0;
  const window = {
    innerWidth: 320,
    innerHeight: 180,
    devicePixelRatio: 2,
    performance: { now: () => time },
    requestAnimationFrame,
    cancelAnimationFrame: vi.fn(),
    setTimeout,
    clearTimeout,
  } as unknown as Window;
  const document = {
    createElement: vi.fn(() => canvas),
  } as unknown as Document;
  return {
    context,
    canvas,
    root,
    frames,
    window,
    document,
    lineWidths,
    strokeStyles,
    globalAlphas,
    setTime(next: number) { time = next; },
  };
}

describe("cursor trail surface", () => {
  it("draws a shared ribbon surface and cleans up its canvas", () => {
    const fixture = createFixture();
    const surface = createCursorTrailSurface({
      window: fixture.window,
      document: fixture.document,
      root: fixture.root,
      respectReducedMotion: false,
    });
    surface.syncConfig({ enabled: true, shape: "ribbon" });
    surface.move(20, 20);
    fixture.setTime(16);
    surface.move(80, 50);
    fixture.frames.shift()?.(20);

    expect(fixture.root.appendChild).toHaveBeenCalledWith(fixture.canvas);
    expect(fixture.context.stroke).toHaveBeenCalled();
    expect(fixture.canvas.width).toBe(640);
    expect(fixture.canvas.height).toBe(360);

    surface.destroy();
    expect(fixture.canvas.remove).toHaveBeenCalledTimes(1);
  });

  it("mixes hexadecimal preset colors deterministically", () => {
    expect(mixCursorTrailColor("#000000", "#FFFFFF", 0.5)).toBe("rgb(128, 128, 128)");
  });

  it("maps blend modes to Canvas composite operations", () => {
    expect(resolveCursorTrailCompositeOperation("normal")).toBe("source-over");
    expect(resolveCursorTrailCompositeOperation("screen")).toBe("screen");
    expect(resolveCursorTrailCompositeOperation("soft-light")).toBe("soft-light");
    expect(resolveCursorTrailCompositeOperation("overlay")).toBe("overlay");
  });

  it("only degrades auto quality when a frame threshold is exceeded", () => {
    expect(resolveNextAutoQuality("fine", 21)).toBe("balanced");
    expect(resolveNextAutoQuality("balanced", 29)).toBe("eco");
    expect(resolveNextAutoQuality("eco", 40)).toBe("eco");
    expect(resolveNextAutoQuality("fine", 16.7)).toBe("fine");
  });

  it("applies the selected blend mode and eco pixel density", () => {
    const fixture = createFixture();
    const surface = createCursorTrailSurface({
      window: fixture.window,
      document: fixture.document,
      root: fixture.root,
      respectReducedMotion: false,
    });
    surface.syncConfig({ enabled: true, shape: "ribbon", quality: "eco", blendMode: "screen" });
    surface.move(20, 20);
    fixture.setTime(40);
    surface.move(80, 50);
    fixture.frames.shift()?.(40);

    expect(fixture.canvas.width).toBe(320);
    expect(fixture.canvas.height).toBe(180);
    expect(fixture.context.globalCompositeOperation).toBe("screen");
  });

  it("interpolates width, color and opacity across three trail segments", () => {
    const fixture = createFixture();
    const surface = createCursorTrailSurface({
      window: fixture.window,
      document: fixture.document,
      root: fixture.root,
      respectReducedMotion: false,
    });
    surface.syncConfig({
      enabled: true,
      shape: "ribbon",
      smoothing: 0,
      velocityResponse: 0,
      segments: {
        tail: { color: "#FF0000", width: 2, opacity: 20 },
        middle: { color: "#0000FF", width: 8, opacity: 60 },
        head: { color: "#00FF00", width: 20, opacity: 100 },
      },
    });
    surface.move(20, 20);
    fixture.setTime(16);
    surface.move(80, 20);
    fixture.setTime(32);
    surface.move(140, 20);
    fixture.frames.shift()?.(40);

    expect(fixture.lineWidths).toContain(20);
    expect(fixture.strokeStyles).toContain("rgb(0, 255, 0)");
    expect(fixture.globalAlphas.some((value) => value > 0.7)).toBe(true);
  });

  it("scatters deterministic sparks when the pointer turns sharply", () => {
    const fixture = createFixture();
    const surface = createCursorTrailSurface({
      window: fixture.window,
      document: fixture.document,
      root: fixture.root,
      respectReducedMotion: false,
    });
    surface.syncConfig({
      enabled: true,
      shape: "ribbon",
      smoothing: 0,
      turnResponse: 100,
      gestureResponse: 0,
    });
    surface.move(20, 20);
    fixture.setTime(16);
    surface.move(100, 20);
    fixture.setTime(32);
    surface.move(100, 100);
    fixture.frames.shift()?.(40);

    expect(fixture.context.fill).toHaveBeenCalled();
  });

  it("draws a stop pulse after a fast move comes to rest", () => {
    const fixture = createFixture();
    const surface = createCursorTrailSurface({
      window: fixture.window,
      document: fixture.document,
      root: fixture.root,
      respectReducedMotion: false,
    });
    surface.syncConfig({
      enabled: true,
      shape: "ribbon",
      smoothing: 0,
      turnResponse: 0,
      gestureResponse: 100,
    });
    surface.move(20, 20);
    fixture.setTime(16);
    surface.move(35, 20);
    fixture.frames.shift()?.(30);
    vi.mocked(fixture.context.arc).mockClear();
    fixture.frames.shift()?.(120);

    expect(fixture.context.arc).toHaveBeenCalled();
  });

  it("bursts forward sparks during a fast flick", () => {
    const fixture = createFixture();
    const surface = createCursorTrailSurface({
      window: fixture.window,
      document: fixture.document,
      root: fixture.root,
      respectReducedMotion: false,
    });
    surface.syncConfig({
      enabled: true,
      shape: "ribbon",
      smoothing: 0,
      turnResponse: 0,
      gestureResponse: 100,
    });
    surface.move(20, 20);
    fixture.setTime(16);
    surface.move(120, 20);
    fixture.frames.shift()?.(30);

    expect(fixture.context.fill).toHaveBeenCalled();
    expect(fixture.context.arc).toHaveBeenCalled();
  });
});
