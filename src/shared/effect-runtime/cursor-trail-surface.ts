/** @platform shared-renderer — Canvas cursor trail used by preview, extension and desktop. */

import {
  normalizeCursorTrailConfig,
} from "@/shared/config/cursor-trail";

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
  kind: "flick" | "stop";
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
  move(x: number, y: number): void;
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
  let lastPoint: TrailPoint | null = null;
  let lastMoveAt = 0;
  let lastFlickAt = Number.NEGATIVE_INFINITY;
  let stopPulseArmed = false;
  let frameId: number | null = null;
  let destroyed = false;
  let reducedMotion = false;
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

  function getSize(): { width: number; height: number; dpr: number } {
    const width = root?.clientWidth || platformWindow.innerWidth || 1;
    const height = root?.clientHeight || platformWindow.innerHeight || 1;
    const dpr = Math.min(2, Math.max(1, platformWindow.devicePixelRatio || 1));
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
      const segment = resolveSegmentStyle(config, progress);
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
      const segment = resolveSegmentStyle(config, progress);
      const velocityGain = 1 + Math.min(1, point.velocity / 24) * (config.velocityResponse / 100);
      const baseRadius = Math.max(1, segment.width * 0.22 * velocityGain);
      context.fillStyle = segment.color;
      context.shadowColor = context.fillStyle;
      context.shadowBlur = config.glow * (1 + Math.min(1, point.velocity / 24) * (config.velocityResponse / 100) * 0.8);
      context.globalAlpha = pointOpacity(point, timestamp, index, points.length, segment.opacity);
      for (let spark = 0; spark < 2; spark += 1) {
        const phase = point.x * 0.07 + point.y * 0.05 + index * 1.7 + spark * Math.PI;
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
      const segment = resolveSegmentStyle(config, progress);
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
      const segment = resolveSegmentStyle(config, progress);
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
    const segment = resolveSegmentStyle(config, kind === "flick" ? 0.9 : 0.65);
    for (let index = 0; index < count; index += 1) {
      const spread = count <= 1 ? 0 : index / (count - 1) * 2 - 1;
      const phase = Math.sin(point.x * 0.071 + point.y * 0.053 + index * 2.17);
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
    if (sparks.length > 96) sparks.splice(0, sparks.length - 96);
  }

  function addGesturePulse(point: TrailPoint, kind: "flick" | "stop", intensity: number, timestamp = point.bornAt): void {
    if (intensity <= 0) return;
    pulses.push({
      x: point.x,
      y: point.y,
      bornAt: timestamp,
      lifetimeMs: kind === "flick" ? 260 : 420,
      intensity,
      kind,
    });
    if (pulses.length > 12) pulses.splice(0, pulses.length - 12);
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
        : 6 + easeOut * (18 + pulse.intensity * 28);
      const segment = resolveSegmentStyle(config, pulse.kind === "stop" ? 0.9 : 0.65);
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
    lastPoint = null;
    stopPulseArmed = false;
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
      config = normalizeCursorTrailConfig(value);
      if (!config.enabled) clear();
      else if (points.length) ensureFrame();
    },
    move(x: number, y: number) {
      if (destroyed || !config.enabled || reducedMotion || !Number.isFinite(x) || !Number.isFinite(y)) return;
      const timestamp = now(platformWindow);
      if (!lastPoint) {
        lastPoint = { x, y, bornAt: timestamp, velocity: 0, dx: 0, dy: 0 };
        lastMoveAt = timestamp;
        points.push(lastPoint);
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
      const turnEnergy = turn * (config.turnResponse / 100);
      if (turnEnergy >= 0.08) addSparkBurst(next, turnEnergy, "turn");
      const flickEnergy = Math.min(1, Math.max(0, (next.velocity - 18) / 28)) * (config.gestureResponse / 100);
      if (flickEnergy >= 0.12 && timestamp - lastFlickAt >= 140) {
        addSparkBurst(next, flickEnergy, "flick");
        addGesturePulse(next, "flick", flickEnergy);
        lastFlickAt = timestamp;
      }
      stopPulseArmed = next.velocity >= 10 && config.gestureResponse > 0;
      if (points.length > config.length) points.splice(0, points.length - config.length);
      ensureFrame();
    },
    leave() {
      lastPoint = null;
      stopPulseArmed = false;
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
