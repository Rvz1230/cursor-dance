/** @platform shared-renderer — Canvas cursor trail used by preview, extension and desktop. */

import {
  normalizeCursorTrailConfig,
  type CursorTrailBlendMode,
  type CursorTrailQuality,
} from "@/shared/config/cursor-trail";

export type CursorTrailResolvedQuality = Exclude<CursorTrailQuality, "auto">;

type CursorTrailQualityProfile = readonly [
  dprCap: number,
  pointLimit: number,
  sparkLimit: number,
  pulseLimit: number,
  stardustLayers: number,
  minFrameIntervalMs: number,
];

const QUALITY_PROFILES: readonly CursorTrailQualityProfile[] = [
  [1, 18, 32, 4, 1, 1_000 / 30],
  [1.5, 36, 64, 8, 2, 0],
  [2, 48, 96, 12, 2, 0],
];

export function resolveCursorTrailCompositeOperation(mode: CursorTrailBlendMode): GlobalCompositeOperation {
  return mode === "normal" ? "source-over" : mode;
}

function resolveCursorTrailQualityProfile(
  quality: CursorTrailQuality,
  autoQuality: CursorTrailResolvedQuality = "fine",
): CursorTrailQualityProfile {
  const resolved = quality === "auto" ? autoQuality : quality;
  return QUALITY_PROFILES[resolved === "eco" ? 0 : resolved === "balanced" ? 1 : 2];
}

export function resolveNextAutoQuality(
  current: CursorTrailResolvedQuality,
  averageFrameMs: number,
): CursorTrailResolvedQuality {
  if (current === "fine" && averageFrameMs > 20) return "balanced";
  if (current === "balanced" && averageFrameMs > 28) return "eco";
  return current;
}

interface TrailPoint {
  x: number;
  y: number;
  bornAt: number;
  velocity: number;
  dx: number;
  dy: number;
}

interface TrailSpark {
  x: number;
  y: number;
  bornAt: number;
  lifetimeMs: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  opacity: number;
}

interface GesturePulse {
  x: number;
  y: number;
  bornAt: number;
  lifetimeMs: number;
  intensity: number;
  kind: "flick" | "stop" | "circle";
  radius: number;
}

export interface CursorTrailCircle {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export interface CursorTrailSurfaceOptions {
  window: Window;
  document: Document;
  root?: HTMLElement;
  respectReducedMotion?: boolean;
  zIndex?: number;
}

export interface CursorTrailSurface {
  syncConfig(value: unknown): void;
  setStateColor(color: string | null): void;
  move(x: number, y: number): void;
  press(): void;
  leave(): void;
  clear(): void;
  destroy(): void;
}

function parseHexColor(value: string): [number, number, number] | null {
  const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const hex = match[1].length === 3
    ? match[1].split("").map((part) => part + part).join("")
    : match[1];
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

export function mixCursorTrailColor(from: string, to: string, progress: number): string {
  const a = parseHexColor(from);
  const b = parseHexColor(to);
  if (!a || !b) return progress < 0.5 ? from : to;
  const t = Math.min(1, Math.max(0, progress));
  return `rgb(${a.map((channel, index) => Math.round(channel + (b[index] - channel) * t)).join(", ")})`;
}

export function fitCursorTrailCircle(path: readonly Pick<TrailPoint, "x" | "y">[]): CursorTrailCircle | null {
  if (path.length < 10) return null;
  let signedTurn = 0;
  let diameter = 0;
  const first = path[0];
  let opposite = first;
  for (let index = 1; index < path.length; index += 1) {
    const current = path[index];
    const previous = path[index - 1];
    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    const distanceFromStart = Math.hypot(current.x - first.x, current.y - first.y);
    if (distanceFromStart > diameter) {
      diameter = distanceFromStart;
      opposite = current;
    }
    if (index < 2) continue;
    const before = path[index - 2];
    const previousDx = previous.x - before.x;
    const previousDy = previous.y - before.y;
    signedTurn += Math.atan2(previousDx * dy - previousDy * dx, previousDx * dx + previousDy * dy);
  }
  const last = path[path.length - 1];
  if (diameter < 32
    || Math.hypot(last.x - first.x, last.y - first.y) > Math.max(28, diameter * 0.45)
    || Math.abs(signedTurn) < Math.PI * 1.45) return null;
  return {
    x: (first.x + opposite.x) / 2,
    y: (first.y + opposite.y) / 2,
    radius: diameter / 2,
  };
}

function resolveSegmentStyle(config: ReturnType<typeof normalizeCursorTrailConfig>, progress: number) {
  const clamped = Math.min(1, Math.max(0, progress));
  const from = clamped <= 0.5 ? config.segments.tail : config.segments.middle;
  const to = clamped <= 0.5 ? config.segments.middle : config.segments.head;
  const localProgress = clamped <= 0.5 ? clamped * 2 : (clamped - 0.5) * 2;
  return {
    color: mixCursorTrailColor(from.color, to.color, localProgress),
    width: from.width + (to.width - from.width) * localProgress,
    opacity: from.opacity + (to.opacity - from.opacity) * localProgress,
  };
}

function now(platformWindow: Window): number {
  return platformWindow.performance?.now?.() ?? Date.now();
}

export function createCursorTrailSurface(options: CursorTrailSurfaceOptions): CursorTrailSurface {
  const { window: platformWindow, document, root } = options;
  const canvas = document.createElement("canvas");
  canvas.dataset.cursordanceTrail = "true";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = [
    root ? "position:absolute" : "position:fixed",
    "inset:0",
    "width:100%",
    "height:100%",
    "pointer-events:none",
    `z-index:${options.zIndex ?? 2147483645}`,
  ].join(";");
  (root ?? document.body ?? document.documentElement).appendChild(canvas);

  let context: CanvasRenderingContext2D | null = null;
  try {
    context = canvas.getContext("2d");
  } catch {
    // jsdom and hardened pages may expose canvas without a rendering backend.
  }

  let config = normalizeCursorTrailConfig(undefined);
  let points: TrailPoint[] = [];
  let sparks: TrailSpark[] = [];
  let pulses: GesturePulse[] = [];
  let gesturePath: TrailPoint[] = [];
  let lastPoint: TrailPoint | null = null;
  let lastMoveAt = 0;
  let lastFlickAt = Number.NEGATIVE_INFINITY;
  let lastCircleAt = Number.NEGATIVE_INFINITY;
  let clickAccentUntil = Number.NEGATIVE_INFINITY;
  let stateColor: string | null = null;
  let stopPulseArmed = false;
  let frameId: number | null = null;
  let destroyed = false;
  let reducedMotion = false;
  let autoQuality: CursorTrailResolvedQuality = "fine";
  let frameSampleTotal = 0;
  let frameSampleCount = 0;
  let lastObservedFrameAt: number | null = null;
  let lastPaintAt = Number.NEGATIVE_INFINITY;
  const mediaQuery = options.respectReducedMotion === false || typeof platformWindow.matchMedia !== "function"
    ? null
    : platformWindow.matchMedia("(prefers-reduced-motion: reduce)");

  const requestFrame = (callback: FrameRequestCallback): number => (
    typeof platformWindow.requestAnimationFrame === "function"
      ? platformWindow.requestAnimationFrame(callback)
      : platformWindow.setTimeout(() => callback(now(platformWindow)), 16)
  );
  const cancelFrame = (id: number): void => {
    if (typeof platformWindow.cancelAnimationFrame === "function") platformWindow.cancelAnimationFrame(id);
    else platformWindow.clearTimeout(id);
  };

  const getQualityProfile = (): CursorTrailQualityProfile => resolveCursorTrailQualityProfile(config.quality, autoQuality);

  function getSegmentStyle(progress: number, timestamp: number) {
    const segment = resolveSegmentStyle(config, progress);
    const overrideColor = timestamp < clickAccentUntil
      ? config.clickColor
      : config.followCursorStateColor ? stateColor : null;
    if (overrideColor) segment.color = overrideColor;
    return segment;
  }

  function observeFrame(timestamp: number): void {
    if (config.quality !== "auto") return;
    if (lastObservedFrameAt !== null) {
      const elapsed = timestamp - lastObservedFrameAt;
      if (elapsed > 0 && elapsed < 250) {
        frameSampleTotal += elapsed;
        frameSampleCount += 1;
      }
    }
    lastObservedFrameAt = timestamp;
    if (frameSampleCount < 24) return;
    autoQuality = resolveNextAutoQuality(autoQuality, frameSampleTotal / frameSampleCount);
    frameSampleTotal = frameSampleCount = 0;
  }

  function getSize(): { width: number; height: number; dpr: number } {
    const width = root?.clientWidth || platformWindow.innerWidth || 1;
    const height = root?.clientHeight || platformWindow.innerHeight || 1;
    const dpr = Math.min(getQualityProfile()[0], Math.max(1, platformWindow.devicePixelRatio || 1));
    return { width, height, dpr };
  }

  function prepareCanvas(): { width: number; height: number } {
    const { width, height, dpr } = getSize();
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    context?.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height };
  }

  function clearCanvas(): void {
    if (!context) return;
    const { width, height } = prepareCanvas();
    context.clearRect(0, 0, width, height);
  }

  function pointOpacity(point: TrailPoint, timestamp: number, index: number, total: number, segmentOpacity: number): number {
    const age = Math.max(0, timestamp - point.bornAt);
    const ageFactor = Math.max(0, 1 - age / config.lifetimeMs);
    const positionFactor = total <= 1 ? 1 : (index + 1) / total;
    const speedEnergy = Math.min(1, point.velocity / 28) * (config.velocityResponse / 100);
    const brightness = 0.78 + speedEnergy * 0.42;
    return Math.min(1, ageFactor * positionFactor * (segmentOpacity / 100) * brightness);
  }

  function drawRibbon(timestamp: number): void {
    if (!context || points.length < 2) return;
    context.lineCap = "round";
    context.lineJoin = "round";
    for (let index = 1; index < points.length; index += 1) {
      const from = points[index - 1];
      const to = points[index];
      const progress = index / Math.max(1, points.length - 1);
      const segment = getSegmentStyle(progress, timestamp);
      const velocityGain = 1 + Math.min(1, to.velocity / 28) * (config.velocityResponse / 100) * 0.75;
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.lineWidth = segment.width * velocityGain;
      context.globalAlpha = pointOpacity(to, timestamp, index, points.length, segment.opacity);
      context.strokeStyle = segment.color;
      context.shadowColor = context.strokeStyle;
      context.shadowBlur = config.glow * (1 + Math.min(1, to.velocity / 28) * (config.velocityResponse / 100) * 0.8);
      context.stroke();
    }
  }

  function drawStardust(timestamp: number): void {
    if (!context) return;
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      const progress = index / Math.max(1, points.length - 1);
      const segment = getSegmentStyle(progress, timestamp);
      const velocityGain = 1 + Math.min(1, point.velocity / 24) * (config.velocityResponse / 100);
      const baseRadius = Math.max(1, segment.width * 0.22 * velocityGain);
      context.fillStyle = segment.color;
      context.shadowColor = context.fillStyle;
      context.shadowBlur = config.glow * (1 + Math.min(1, point.velocity / 24) * (config.velocityResponse / 100) * 0.8);
      context.globalAlpha = pointOpacity(point, timestamp, index, points.length, segment.opacity);
      for (let spark = 0; spark < getQualityProfile()[4]; spark += 1) {
        const phase = point.x * 0.07 + point.y * 0.05 + index * 1.7 + spark * Math.PI + config.randomSeed * 0.017;
        const offset = segment.width * (0.35 + spark * 0.25);
        context.beginPath();
        context.arc(
          point.x + Math.cos(phase) * offset,
          point.y + Math.sin(phase) * offset,
          baseRadius * (spark === 0 ? 1 : 0.55),
          0,
          Math.PI * 2,
        );
        context.fill();
      }
    }
  }

  function drawPixels(timestamp: number): void {
    if (!context) return;
    context.shadowBlur = config.glow;
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      const progress = index / Math.max(1, points.length - 1);
      const segment = getSegmentStyle(progress, timestamp);
      const size = Math.max(2, segment.width);
      context.fillStyle = segment.color;
      context.shadowColor = context.fillStyle;
      context.globalAlpha = pointOpacity(point, timestamp, index, points.length, segment.opacity);
      context.fillRect(Math.round(point.x - size / 2), Math.round(point.y - size / 2), Math.round(size), Math.round(size));
    }
  }

  function drawEcho(timestamp: number): void {
    if (!context) return;
    const stride = Math.max(1, Math.round(points.length / 8));
    for (let index = 0; index < points.length; index += stride) {
      const point = points[index];
      const progress = index / Math.max(1, points.length - 1);
      const segment = getSegmentStyle(progress, timestamp);
      const size = segment.width;
      context.save();
      context.translate(point.x, point.y);
      context.scale(size / 16, size / 16);
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(0, 15);
      context.lineTo(4.2, 11.2);
      context.lineTo(7.2, 17);
      context.lineTo(10.3, 15.4);
      context.lineTo(7.2, 9.7);
      context.lineTo(12.5, 9.7);
      context.closePath();
      context.fillStyle = segment.color;
      context.shadowColor = context.fillStyle;
      context.shadowBlur = config.glow;
      context.globalAlpha = pointOpacity(point, timestamp, index, points.length, segment.opacity);
      context.fill();
      context.restore();
    }
  }

  function addSparkBurst(point: TrailPoint, intensity: number, kind: "turn" | "flick"): void {
    if (intensity <= 0) return;
    const count = Math.max(1, Math.min(kind === "flick" ? 8 : 4, Math.round(1 + intensity * (kind === "flick" ? 7 : 3))));
    const directionLength = Math.max(1, Math.hypot(point.dx, point.dy));
    const unitX = point.dx / directionLength;
    const unitY = point.dy / directionLength;
    const sideX = -unitY;
    const sideY = unitX;
    const segment = getSegmentStyle(kind === "flick" ? 0.9 : 0.65, point.bornAt);
    for (let index = 0; index < count; index += 1) {
      const spread = count <= 1 ? 0 : index / (count - 1) * 2 - 1;
      const phase = Math.sin(point.x * 0.071 + point.y * 0.053 + index * 2.17 + config.randomSeed * 0.013);
      const forward = kind === "flick" ? 1.6 + intensity * 2.8 : 0.35 + intensity;
      const sideways = spread * (kind === "flick" ? 2.4 : 3.2) * intensity + phase * 0.45;
      sparks.push({
        x: point.x,
        y: point.y,
        bornAt: point.bornAt,
        lifetimeMs: kind === "flick" ? 260 + intensity * 180 : 180 + intensity * 160,
        vx: unitX * forward + sideX * sideways,
        vy: unitY * forward + sideY * sideways,
        size: Math.max(1.2, segment.width * (kind === "flick" ? 0.2 : 0.13) * (0.7 + intensity)),
        color: segment.color,
        opacity: segment.opacity,
      });
    }
    const sparkLimit = getQualityProfile()[2];
    if (sparks.length > sparkLimit) sparks.splice(0, sparks.length - sparkLimit);
  }

  function addGesturePulse(
    point: TrailPoint,
    kind: GesturePulse["kind"],
    intensity: number,
    timestamp = point.bornAt,
    radius = 0,
  ): void {
    if (intensity <= 0) return;
    pulses.push({
      x: point.x,
      y: point.y,
      bornAt: timestamp,
      lifetimeMs: kind === "flick" ? 260 : kind === "circle" ? 680 : 420,
      intensity,
      kind,
      radius,
    });
    const pulseLimit = getQualityProfile()[3];
    if (pulses.length > pulseLimit) pulses.splice(0, pulses.length - pulseLimit);
  }

  function drawSparks(timestamp: number): void {
    if (!context) return;
    for (const spark of sparks) {
      const progress = Math.min(1, Math.max(0, (timestamp - spark.bornAt) / spark.lifetimeMs));
      const travel = (timestamp - spark.bornAt) / 16.67;
      const size = spark.size * (1 - progress * 0.55);
      context.beginPath();
      context.arc(spark.x + spark.vx * travel, spark.y + spark.vy * travel, size, 0, Math.PI * 2);
      context.fillStyle = spark.color;
      context.shadowColor = spark.color;
      context.shadowBlur = config.glow * 0.7;
      context.globalAlpha = (1 - progress) * (spark.opacity / 100);
      context.fill();
    }
  }

  function drawGesturePulses(timestamp: number): void {
    if (!context) return;
    for (const pulse of pulses) {
      const progress = Math.min(1, Math.max(0, (timestamp - pulse.bornAt) / pulse.lifetimeMs));
      const easeOut = 1 - (1 - progress) ** 3;
      const radius = pulse.kind === "stop"
        ? 5 + (1 - easeOut) * (18 + pulse.intensity * 22)
        : pulse.kind === "circle"
          ? pulse.radius * (0.88 + easeOut * 0.12)
          : 6 + easeOut * (18 + pulse.intensity * 28);
      const segment = getSegmentStyle(pulse.kind === "stop" ? 0.9 : 0.65, timestamp);
      const color = segment.color;
      context.beginPath();
      context.arc(pulse.x, pulse.y, radius, 0, Math.PI * 2);
      context.strokeStyle = color;
      context.lineWidth = Math.max(1, segment.width * 0.14 * pulse.intensity * (1 - progress * 0.5));
      context.shadowColor = color;
      context.shadowBlur = config.glow + 8 * pulse.intensity;
      context.globalAlpha = (1 - progress) * (segment.opacity / 100) * pulse.intensity;
      context.stroke();
    }
  }

  function render(timestamp: number): void {
    frameId = null;
    if (destroyed || !config.enabled || reducedMotion) {
      clearCanvas();
      return;
    }
    observeFrame(timestamp);
    const qualityProfile = getQualityProfile();
    if (timestamp - lastPaintAt < qualityProfile[5]) {
      frameId = requestFrame(render);
      return;
    }
    lastPaintAt = timestamp;
    if (stopPulseArmed && lastPoint && timestamp - lastMoveAt >= 90) {
      const stopEnergy = Math.min(1, lastPoint.velocity / 24) * (config.gestureResponse / 100);
      addGesturePulse(lastPoint, "stop", stopEnergy, lastMoveAt + 90);
      stopPulseArmed = false;
    }
    points = points.filter((point) => timestamp - point.bornAt < config.lifetimeMs);
    sparks = sparks.filter((spark) => timestamp - spark.bornAt < spark.lifetimeMs);
    pulses = pulses.filter((pulse) => timestamp - pulse.bornAt < pulse.lifetimeMs);
    clearCanvas();
    if (!points.length && !sparks.length && !pulses.length) {
      lastPoint = null;
      return;
    }
    if (context) {
      context.save();
      context.globalCompositeOperation = resolveCursorTrailCompositeOperation(config.blendMode);
      if (config.shape === "stardust") drawStardust(timestamp);
      else if (config.shape === "pixel") drawPixels(timestamp);
      else if (config.shape === "echo") drawEcho(timestamp);
      else drawRibbon(timestamp);
      drawSparks(timestamp);
      drawGesturePulses(timestamp);
      context.restore();
    }
    frameId = requestFrame(render);
  }

  function ensureFrame(): void {
    if (frameId === null && config.enabled && !reducedMotion) frameId = requestFrame(render);
  }

  function clear(): void {
    points = [];
    sparks = [];
    pulses = [];
    gesturePath = [];
    lastPoint = null;
    stopPulseArmed = false;
    clickAccentUntil = Number.NEGATIVE_INFINITY;
    frameSampleTotal = frameSampleCount = 0;
    lastObservedFrameAt = null;
    lastPaintAt = Number.NEGATIVE_INFINITY;
    if (frameId !== null) cancelFrame(frameId);
    frameId = null;
    clearCanvas();
  }

  function syncReducedMotion(): void {
    reducedMotion = mediaQuery?.matches === true;
    if (reducedMotion) clear();
  }

  const handleReducedMotionChange = (): void => syncReducedMotion();
  mediaQuery?.addEventListener?.("change", handleReducedMotionChange);
  syncReducedMotion();

  return {
    syncConfig(value: unknown) {
      const previousQuality = config.quality;
      config = normalizeCursorTrailConfig(value);
      if (config.quality !== previousQuality) {
        autoQuality = "fine";
        frameSampleTotal = frameSampleCount = 0;
        lastObservedFrameAt = null;
        lastPaintAt = Number.NEGATIVE_INFINITY;
      }
      if (!config.enabled) clear();
      else if (points.length) ensureFrame();
    },
    setStateColor(color: string | null) {
      stateColor = typeof color === "string" && color.trim() ? color.trim() : null;
      if (points.length) ensureFrame();
    },
    move(x: number, y: number) {
      if (destroyed || !config.enabled || reducedMotion || !Number.isFinite(x) || !Number.isFinite(y)) return;
      const timestamp = now(platformWindow);
      if (!lastPoint) {
        lastPoint = { x, y, bornAt: timestamp, velocity: 0, dx: 0, dy: 0 };
        lastMoveAt = timestamp;
        points.push(lastPoint);
        gesturePath = [lastPoint];
        ensureFrame();
        return;
      }
      const dx = x - lastPoint.x;
      const dy = y - lastPoint.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 1.5) return;
      const elapsed = Math.max(1, timestamp - lastPoint.bornAt);
      const follow = 1 - (config.smoothing / 100) * 0.82;
      const nextDx = dx * follow;
      const nextDy = dy * follow;
      const previousLength = Math.hypot(lastPoint.dx, lastPoint.dy);
      const nextLength = Math.max(1, Math.hypot(nextDx, nextDy));
      const directionDot = previousLength > 0
        ? (lastPoint.dx * nextDx + lastPoint.dy * nextDy) / (previousLength * nextLength)
        : 1;
      const turn = Math.min(1, Math.max(0, (1 - directionDot) / 2));
      const next: TrailPoint = {
        x: lastPoint.x + nextDx,
        y: lastPoint.y + nextDy,
        bornAt: timestamp,
        velocity: distance / elapsed * 16.67,
        dx: nextDx,
        dy: nextDy,
      };
      lastPoint = next;
      lastMoveAt = timestamp;
      points.push(next);
      gesturePath.push(next);
      gesturePath = gesturePath.filter((point) => timestamp - point.bornAt <= 900).slice(-32);
      const turnEnergy = turn * (config.turnResponse / 100);
      if (turnEnergy >= 0.08) addSparkBurst(next, turnEnergy, "turn");
      const flickEnergy = Math.min(1, Math.max(0, (next.velocity - 18) / 28)) * (config.gestureResponse / 100);
      if (flickEnergy >= 0.12 && timestamp - lastFlickAt >= 140) {
        addSparkBurst(next, flickEnergy, "flick");
        addGesturePulse(next, "flick", flickEnergy);
        lastFlickAt = timestamp;
      }
      const circle = timestamp - lastCircleAt >= 700 ? fitCursorTrailCircle(gesturePath) : null;
      if (circle) {
        addGesturePulse(
          { ...next, x: circle.x, y: circle.y },
          "circle",
          config.gestureResponse / 100,
          timestamp,
          circle.radius,
        );
        gesturePath = [next];
        lastCircleAt = timestamp;
      }
      stopPulseArmed = next.velocity >= 10 && config.gestureResponse > 0;
      const pointLimit = Math.min(config.length, getQualityProfile()[1]);
      if (points.length > pointLimit) points.splice(0, points.length - pointLimit);
      ensureFrame();
    },
    press() {
      if (destroyed || !config.enabled || reducedMotion) return;
      clickAccentUntil = now(platformWindow) + config.clickDurationMs;
      ensureFrame();
    },
    leave() {
      lastPoint = null;
      stopPulseArmed = false;
      gesturePath = [];
      ensureFrame();
    },
    clear,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      mediaQuery?.removeEventListener?.("change", handleReducedMotionChange);
      clear();
      canvas.remove();
    },
  };
}
