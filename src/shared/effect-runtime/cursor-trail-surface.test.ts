import { describe, expect, it, vi } from "vitest";
import {
  createCursorTrailSurface,
  fitCursorTrailCircle,
  mixCursorTrailColor,
  resolveCursorTrailCompositeOperation,
  resolveCursorTrailVelocityGain,
  resolveNextAutoQuality,
  sampleCursorTrailNoise,
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
    rotate: vi.fn(),
    scale: vi.fn(),
    closePath: vi.fn(),
    fillText: vi.fn(),
    lineCap: "butt",
    lineJoin: "miter",
    lineWidth: 1,
    globalAlpha: 1,
    strokeStyle: "",
    fillStyle: "",
    shadowColor: "",
    shadowBlur: 0,
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
  } as unknown as CanvasRenderingContext2D;
  const lineWidths: number[] = [];
  const strokeStyles: string[] = [];
  const fillStyles: string[] = [];
  const globalAlphas: number[] = [];
  const fonts: string[] = [];
  Object.defineProperty(context, "lineWidth", { configurable: true, get: () => lineWidths[lineWidths.length - 1] ?? 1, set: (value) => lineWidths.push(value) });
  Object.defineProperty(context, "strokeStyle", { configurable: true, get: () => strokeStyles[strokeStyles.length - 1] ?? "", set: (value) => strokeStyles.push(String(value)) });
  Object.defineProperty(context, "fillStyle", { configurable: true, get: () => fillStyles[fillStyles.length - 1] ?? "", set: (value) => fillStyles.push(String(value)) });
  Object.defineProperty(context, "globalAlpha", { configurable: true, get: () => globalAlphas[globalAlphas.length - 1] ?? 1, set: (value) => globalAlphas.push(value) });
  Object.defineProperty(context, "font", { configurable: true, get: () => fonts[fonts.length - 1] ?? "", set: (value) => fonts.push(String(value)) });
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
    fillStyles,
    globalAlphas,
    fonts,
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
    expect(sampleCursorTrailNoise(42, 10, 20, 3)).toBe(sampleCursorTrailNoise(42, 10, 20, 3));
    expect(sampleCursorTrailNoise(42, 10, 20, 3)).not.toBe(sampleCursorTrailNoise(43, 10, 20, 3));
    expect(resolveCursorTrailVelocityGain(28, 100)).toBe(1.75);
    expect(resolveCursorTrailVelocityGain(28, 0)).toBe(1);
  });

  it.each([
    ["flame", "fill"],
    ["ink", "fill"],
    ["liquid", "stroke"],
    ["lightning", "stroke"],
    ["petal", "fill"],
    ["note", "fillText"],
    ["code", "fillText"],
  ] as const)("renders the %s material through its Canvas primitive", (material, method) => {
    const fixture = createFixture();
    const surface = createCursorTrailSurface({
      window: fixture.window,
      document: fixture.document,
      root: fixture.root,
      respectReducedMotion: false,
    });
    surface.syncConfig({ enabled: true, shape: "ribbon", material, smoothing: 0, gestureResponse: 0, turnResponse: 0 });
    surface.move(20, 20);
    fixture.setTime(16);
    surface.move(80, 50);
    fixture.frames.shift()?.(20);

    expect(fixture.context[method]).toHaveBeenCalled();
  });

  it.each(["neon", "flame", "ink", "liquid", "lightning", "petal", "note", "code"] as const)(
    "maps pointer velocity into %s material geometry",
    (material) => {
      function renderGeometry(elapsed: number) {
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
          material,
          smoothing: 0,
          velocityResponse: 100,
          gestureResponse: 0,
          turnResponse: 0,
        });
        surface.move(20, 20);
        fixture.setTime(elapsed);
        surface.move(100, 50);
        fixture.frames.shift()?.(elapsed + 1);
        return {
          lineWidths: fixture.lineWidths,
          radii: vi.mocked(fixture.context.arc).mock.calls.map((call) => call[2]),
          fonts: fixture.fonts,
        };
      }

      expect(renderGeometry(16)).not.toEqual(renderGeometry(160));
    },
  );

  it("recognizes a closed circular gesture without matching an open arc", () => {
    const circle = Array.from({ length: 17 }, (_, index) => {
      const angle = index / 16 * Math.PI * 2;
      return { x: 100 + Math.cos(angle) * 50, y: 100 + Math.sin(angle) * 50 };
    });
    const fitted = fitCursorTrailCircle(circle);
    expect(fitted?.x).toBeCloseTo(100);
    expect(fitted?.y).toBeCloseTo(100);
    expect(fitted?.radius).toBeCloseTo(50);
    expect(fitCursorTrailCircle(circle.slice(0, 12))).toBeNull();
  });

  it("renders a completed circle pulse at the fitted center and radius", () => {
    const fixture = createFixture();
    const surface = createCursorTrailSurface({
      window: fixture.window,
      document: fixture.document,
      root: fixture.root,
      respectReducedMotion: false,
    });
    surface.syncConfig({ enabled: true, smoothing: 0, gestureResponse: 100, turnResponse: 0 });
    for (let index = 0; index <= 16; index += 1) {
      const angle = index / 16 * Math.PI * 2;
      fixture.setTime(index * 50);
      surface.move(100 + Math.cos(angle) * 50, 100 + Math.sin(angle) * 50);
    }
    fixture.frames.shift()?.(820);

    const circleArc = vi.mocked(fixture.context.arc).mock.calls.find((call) => call[2] > 40);
    expect(circleArc?.[0]).toBeCloseTo(100);
    expect(circleArc?.[1]).toBeCloseTo(100);
    expect(circleArc?.[2]).toBeGreaterThan(40);
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

  it("uses CSS background blending on page surfaces and eco pixel density", () => {
    const fixture = createFixture();
    const surface = createCursorTrailSurface({
      window: fixture.window,
      document: fixture.document,
      root: fixture.root,
      blendWithPage: true,
      respectReducedMotion: false,
    });
    surface.syncConfig({ enabled: true, shape: "ribbon", quality: "eco", blendMode: "screen" });
    surface.move(20, 20);
    fixture.setTime(40);
    surface.move(80, 50);
    fixture.frames.shift()?.(40);

    expect(fixture.canvas.width).toBe(320);
    expect(fixture.canvas.height).toBe(180);
    expect(fixture.canvas.style.mixBlendMode).toBe("screen");
    expect(fixture.context.globalCompositeOperation).toBe("source-over");
  });

  it("falls back to Canvas composition for transparent desktop overlays", () => {
    const fixture = createFixture();
    const surface = createCursorTrailSurface({
      window: fixture.window,
      document: fixture.document,
      root: fixture.root,
      respectReducedMotion: false,
    });
    surface.syncConfig({ enabled: true, shape: "ribbon", blendMode: "soft-light" });
    surface.move(20, 20);
    fixture.setTime(16);
    surface.move(80, 50);
    fixture.frames.shift()?.(20);

    expect(fixture.canvas.style.mixBlendMode).toBe("normal");
    expect(fixture.context.globalCompositeOperation).toBe("soft-light");
  });

  it("temporarily recolors the visible trail after a press", () => {
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
      clickColor: "#FFFFFF",
      clickDurationMs: 200,
      segments: {
        tail: { color: "#000000", width: 2, opacity: 100 },
        middle: { color: "#000000", width: 4, opacity: 100 },
        head: { color: "#000000", width: 8, opacity: 100 },
      },
    });
    surface.move(20, 20);
    fixture.setTime(16);
    surface.move(80, 20);
    surface.press();
    fixture.frames.shift()?.(20);

    expect(fixture.strokeStyles).toContain("#FFFFFF");
  });

  it("uses the current cursor-state color when following is enabled", () => {
    const fixture = createFixture();
    const surface = createCursorTrailSurface({
      window: fixture.window,
      document: fixture.document,
      root: fixture.root,
      respectReducedMotion: false,
    });
    surface.syncConfig({ enabled: true, shape: "ribbon", smoothing: 0, followCursorStateColor: true });
    surface.setStateColor("#22C55E");
    surface.move(20, 20);
    fixture.setTime(16);
    surface.move(80, 20);
    fixture.frames.shift()?.(20);

    expect(fixture.strokeStyles).toContain("#22C55E");
  });

  it("keeps seeded stardust positions stable across surfaces", () => {
    function render(seed: number) {
      const fixture = createFixture();
      const surface = createCursorTrailSurface({
        window: fixture.window,
        document: fixture.document,
        root: fixture.root,
        respectReducedMotion: false,
      });
      surface.syncConfig({ enabled: true, shape: "stardust", smoothing: 0, randomSeed: seed });
      surface.move(20, 20);
      fixture.setTime(16);
      surface.move(80, 50);
      fixture.frames.shift()?.(20);
      return vi.mocked(fixture.context.arc).mock.calls;
    }

    expect(render(42)).toEqual(render(42));
    expect(render(42)).not.toEqual(render(43));
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

  it("recolors already-scattered sparks while the click accent is active", () => {
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
      clickColor: "#FFFFFF",
      segments: {
        tail: { color: "#000000", width: 2, opacity: 100 },
        middle: { color: "#000000", width: 4, opacity: 100 },
        head: { color: "#000000", width: 8, opacity: 100 },
      },
    });
    surface.move(20, 20);
    fixture.setTime(16);
    surface.move(100, 20);
    fixture.setTime(32);
    surface.move(100, 100);
    surface.press();
    fixture.frames.shift()?.(40);

    expect(fixture.fillStyles).toContain("#FFFFFF");
  });

  it("converges into a light point after a slow move pauses", () => {
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
    fixture.setTime(100);
    surface.move(25, 20);
    fixture.frames.shift()?.(190);

    const initialRadius = vi.mocked(fixture.context.arc).mock.calls[0]?.[2];
    expect(initialRadius).toBeGreaterThan(10);

    vi.mocked(fixture.context.arc).mockClear();
    vi.mocked(fixture.context.fill).mockClear();
    fixture.frames.shift()?.(360);

    expect(fixture.context.arc).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fixture.context.arc).mock.calls[0]?.[2]).toBeLessThan(initialRadius);
    expect(fixture.context.fill).toHaveBeenCalled();
  });

  it("adds a separate outward ripple after a fast move stops", () => {
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
    surface.move(32, 20);
    fixture.frames.shift()?.(106);

    const initialRadii = vi.mocked(fixture.context.arc).mock.calls.map((call) => call[2]);
    expect(initialRadii).toHaveLength(3);
    expect(initialRadii[0]).toBeGreaterThan(initialRadii[2]);

    vi.mocked(fixture.context.arc).mockClear();
    fixture.frames.shift()?.(300);
    const laterRadii = vi.mocked(fixture.context.arc).mock.calls.map((call) => call[2]);

    expect(laterRadii).toHaveLength(3);
    expect(laterRadii[0]).toBeLessThan(initialRadii[0]);
    expect(laterRadii[2]).toBeGreaterThan(initialRadii[2]);
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
